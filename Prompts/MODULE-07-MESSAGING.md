# Module 07: Messaging

[Existing content]

---

## Prompt Addendum: Masked Identities + Text Moderation

### AI Prompt for Cursor (Messaging Safety Rules)

```typescript
/*
TASK: Enforce masked identities and block off-platform contact/payment attempts in chat

REQUIREMENTS:
1. Display names: first name + alias only; hide phone/email/last name
2. Text moderation: reject messages containing contact info (phone, email) or off-platform payments (PayPal, Venmo, Cash App)
3. System messages: inject safe meetup tips upon trade acceptance
4. Admin review: log blocked messages with reason

FILES:
- src/services/moderation.ts (moderateMessage(text): {allowed, reason})
- src/screens/chat/ChatScreen.tsx (apply moderation before send)
- admin/app/moderation/messages/page.tsx (blocked messages queue)
*/
```

### Acceptance Criteria
- Chat UI shows masked identities
- Messages with PII/off-platform terms are blocked
- Safe meetup tips auto-inserted
- Blocked messages logged for admin review

# MODULE 07: MESSAGING & CHAT

**Total Tasks:** 9  
**Estimated Time:** ~24.5 hours  
**Dependencies:** MODULE-02 (Authentication), MODULE-06 (Trade Flow)

---

### Agent-Optimized Prompt Template (Claude Sonnet 4.5)

Add this preamble to each AI prompt block when running in Claude Sonnet 4.5 mode. It guides the agent to reason, verify, and produce tests alongside code.

```text
@agent: claude-sonnet-4.5
@mode: extended-reasoning
@autonomy: high

AGENT INSTRUCTIONS:
1. Read the entire task before generating code.
2. Produce a short plan (3-6 steps) and list any missing dependencies.
3. Generate the requested files exactly at the `filepath` locations.
4. Create unit tests for critical logic using the project's test framework.
5. Run a self-check list: type-check, lint, and run the new tests (if environment available).
6. Add concise TODO comments where manual verification is required (secrets, environment variables, or infra setup).

VERIFICATION STEPS (agent must print results):
- TypeScript type-check: `npm run type-check` (or `yarn tsc`)
- Linting: `npm run lint`
- Tests: `npm test -- --testPathPattern=<new tests>`

ERROR HANDLING RULES:
- If a required file/dependency is missing, stop and report exact missing paths.
- For runtime secrets (API keys), inject clear TODOs and do not attempt to store secrets in code.
- For database schema mismatches, add migration stubs and mark for manual review.

REASONING GUIDELINES:
- Provide brief chain-of-thought before producing complex SQL or payment flows.
- Flag performance, security, and privacy concerns.
```

---

## TASK MSG-001: Implement Supabase Realtime Chat (Text Messages)

**Duration:** 4 hours  
**Priority:** Critical  
**Dependencies:** TRADE-001 (Trade initiation), AUTH-001 (Authentication)

### Description
Implement real-time text messaging between buyer and seller using Supabase Realtime. Create messages table with trade_id foreign key. Subscribe to message inserts for live updates. Support text-only messages initially.

---

### AI Prompt for Cursor (Generate Realtime Chat)

```typescript
/*
TASK: Implement Supabase Realtime chat for trades

CONTEXT:
Buyers and sellers communicate during trades.
Messages are scoped to a specific trade.
Real-time updates via Supabase Realtime.

REQUIREMENTS:
1. Create messages database table
2. Implement chat service with Realtime subscriptions
3. Send and receive text messages
4. Display messages in chronological order
5. Auto-scroll to latest message

==================================================
FILE 1: Database migration for messages
==================================================
*/

-- filepath: supabase/migrations/025_messages.sql

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image')),
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT content_or_image CHECK (
    (message_type = 'text' AND content IS NOT NULL) OR
    (message_type = 'image' AND image_url IS NOT NULL)
  )
);

CREATE INDEX messages_trade_id_idx ON messages(trade_id);
CREATE INDEX messages_sender_id_idx ON messages(sender_id);
CREATE INDEX messages_created_at_idx ON messages(created_at);

-- RLS policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages from their trades
CREATE POLICY "Users can view messages from own trades"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = messages.trade_id
      AND (trades.buyer_id = auth.uid() OR trades.seller_id = auth.uid())
    )
  );

-- Users can send messages to their trades
CREATE POLICY "Users can send messages to own trades"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_id
      AND (trades.buyer_id = auth.uid() OR trades.seller_id = auth.uid())
    )
  );

-- Users can delete own messages
CREATE POLICY "Users can delete own messages"
  ON messages FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- Auto-update updated_at timestamp
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

/*
==================================================
FILE 2: Chat service with Realtime
==================================================
*/

// filepath: src/services/chat.ts

import { createClient } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Message {
  id: string;
  trade_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image';
  image_url?: string;
  created_at: string;
  sender?: {
    first_name: string;
    profile_image_url: string;
  };
}

export async function sendMessage(
  tradeId: string,
  senderId: string,
  content: string
): Promise<Message | null> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        trade_id: tradeId,
        sender_id: senderId,
        content: content.trim(),
        message_type: 'text',
      })
      .select(`
        *,
        users!sender_id(first_name, profile_image_url)
      `)
      .single();

    if (error) throw error;

    return {
      ...data,
      sender: data.users,
    };
  } catch (error) {
    console.error('Send message error:', error);
    return null;
  }
}

export async function getMessages(tradeId: string): Promise<Message[]> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        users!sender_id(first_name, profile_image_url)
      `)
      .eq('trade_id', tradeId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((msg) => ({
      ...msg,
      sender: msg.users,
    }));
  } catch (error) {
    console.error('Get messages error:', error);
    return [];
  }
}

export function subscribeToMessages(
  tradeId: string,
  onMessage: (message: Message) => void
): RealtimeChannel {
  const supabase = createClient();

  const channel = supabase
    .channel(`trade:${tradeId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `trade_id=eq.${tradeId}`,
      },
      async (payload) => {
        // Fetch full message with sender info
        const { data } = await supabase
          .from('messages')
          .select(`
            *,
            users!sender_id(first_name, profile_image_url)
          `)
          .eq('id', payload.new.id)
          .single();

        if (data) {
          onMessage({
            ...data,
            sender: data.users,
          });
        }
      }
    )
    .subscribe();

  return channel;
}

export function unsubscribeFromMessages(channel: RealtimeChannel) {
  channel.unsubscribe();
}

/*
==================================================
FILE 3: Chat screen UI
==================================================
*/

// filepath: src/screens/chat/ChatScreen.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '@/hooks/useAuth';
import {
  getMessages,
  sendMessage,
  subscribeToMessages,
  unsubscribeFromMessages,
  Message,
} from '@/services/chat';
import { RealtimeChannel } from '@supabase/supabase-js';

type ChatScreenRouteProp = RouteProp<{ Chat: { tradeId: string } }, 'Chat'>;

export function ChatScreen() {
  const route = useRoute<ChatScreenRouteProp>();
  const { tradeId } = route.params;
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    loadMessages();

    // Subscribe to new messages
    channelRef.current = subscribeToMessages(tradeId, (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
      setTimeout(() => scrollToBottom(), 100);
    });

    return () => {
      if (channelRef.current) {
        unsubscribeFromMessages(channelRef.current);
      }
    };
  }, [tradeId]);

  const loadMessages = async () => {
    setLoading(true);
    const msgs = await getMessages(tradeId);
    setMessages(msgs);
    setLoading(false);
    setTimeout(() => scrollToBottom(), 100);
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  const handleSend = async () => {
    if (!inputText.trim() || !user?.id || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const newMessage = await sendMessage(tradeId, user.id, messageText);
      // Message will be added via Realtime subscription
    } catch (error) {
      console.error('Send message error:', error);
      setInputText(messageText); // Restore input on error
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sender_id === user?.id;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        {!isOwnMessage && (
          <Text style={styles.senderName}>{item.sender?.first_name}</Text>
        )}
        <View
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownBubble : styles.otherBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isOwnMessage ? styles.ownText : styles.otherText,
            ]}
          >
            {item.content}
          </Text>
        </View>
        <Text style={styles.messageTime}>
          {new Date(item.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => scrollToBottom()}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '75%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ownBubble: {
    backgroundColor: '#3B82F6',
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageText: {
    fontSize: 16,
  },
  ownText: {
    color: '#FFFFFF',
  },
  otherText: {
    color: '#111827',
  },
  messageTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    marginHorizontal: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Messages table created with RLS policies
✓ Real-time message updates via Supabase Realtime
✓ Send text messages
✓ Display messages chronologically
✓ Auto-scroll to latest message
✓ Distinguish own vs other messages
✓ Show sender name and timestamp

==================================================
NEXT TASK
==================================================

MSG-002: Create chat UI (conversation list)
*/
```

---

### Output Files

1. **supabase/migrations/025_messages.sql** - Messages table and RLS policies
2. **src/services/chat.ts** - Chat service with Realtime subscriptions
3. **src/screens/chat/ChatScreen.tsx** - Chat screen UI

---

### Testing Steps

1. **Test message sending:**
   - Type message → Tap Send → Message appears immediately
   - Verify message saved to database

2. **Test real-time updates:**
   - Open chat on two devices → Send message from one
   - Verify other device receives message instantly

3. **Test chronological order:**
   - Send multiple messages → Verify displayed in order

4. **Test auto-scroll:**
   - Send message → Screen auto-scrolls to bottom

5. **Test RLS policies:**
   - Non-trade participants cannot view messages

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create messages table migration | 45 min |
| Build chat service with Realtime | 90 min |
| Create chat screen UI | 60 min |
| Test messaging functionality | 45 min |
| **Total** | **~4 hours** |

---

## TASK MSG-002: Create Chat UI (Conversation List, Chat Screen)

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** MSG-001 (Realtime chat)

### Description
Create conversation list screen showing all active chats. Display last message preview, unread count, and timestamp. Navigate to chat screen on tap. Update conversation list in real-time when new messages arrive.

---

### AI Prompt for Cursor (Generate Conversation List)

```typescript
/*
TASK: Create conversation list UI

CONTEXT:
Users see all their active trade chats.
Shows last message preview and unread count.

REQUIREMENTS:
1. Fetch user's trades with messages
2. Display conversation cards
3. Show last message preview
4. Show unread message count
5. Navigate to chat screen
6. Real-time updates for new messages

FILE: src/screens/chat/ConversationsListScreen.tsx
- List of conversations
- Last message preview
- Unread badge
- Navigate to ChatScreen

FILE: src/services/chat.ts (UPDATE)
- Add getConversations()
- Add getUnreadCount()
- Add markAsRead()
*/
```

### Time Breakdown: **~3 hours**

---

## TASK MSG-003: Implement Image Sharing in Chat

**Duration:** 3.5 hours  
**Priority:** Medium  
**Dependencies:** MSG-001 (Realtime chat), ITEM-002 (Image upload)

### Description
Allow users to share images in chat. Upload images to Supabase Storage (chat-images bucket). Display images inline in chat. Support image preview/fullscreen view. Compress images before upload.

---

### AI Prompt for Cursor (Generate Image Sharing)

```typescript
/*
TASK: Add image sharing to chat

CONTEXT:
Users can share item photos during trades.
Images uploaded to Supabase Storage.

REQUIREMENTS:
1. Add image picker button to chat input
2. Upload images to Supabase Storage
3. Create message with image_url
4. Display images inline in chat
5. Image preview/fullscreen view
6. Compress images before upload

FILE: src/screens/chat/ChatScreen.tsx (UPDATE)
- Add image picker button
- Upload image to storage
- Send image message
- Display image messages

FILE: src/services/chat.ts (UPDATE)
- Add sendImageMessage()
- Add uploadChatImage()
*/
```

### Time Breakdown: **~3.5 hours**

---

## TASK MSG-004: Implement Message Expiration (Delete After 30 Days Post-Trade)

**Duration:** 2 hours  
**Priority:** Medium  
**Dependencies:** MSG-001 (Realtime chat), TRADE-002 (Trade status)

### Description
Automatically delete messages 30 days after trade completion. Admin-configurable expiration period. Soft delete (set deleted_at timestamp). Create database function to mark expired messages.

---

### AI Prompt for Cursor (Generate Message Expiration)

```typescript
/*
TASK: Implement message expiration logic

CONTEXT:
Messages expire X days after trade completion.
Configurable by admin (default 30 days).

REQUIREMENTS:
1. Admin config for expiration days
2. Database function to find expired messages
3. Soft delete (set deleted_at)
4. Exclude deleted messages from queries

==================================================
FILE 1: Admin config for expiration
==================================================
*/

-- filepath: supabase/migrations/026_message_expiration.sql

-- Add admin config
INSERT INTO admin_config (key, value, value_type, description)
VALUES (
  'message_expiration_days',
  '30',
  'number',
  'Days after trade completion before messages are deleted'
)
ON CONFLICT (key) DO NOTHING;

-- Function to mark expired messages
CREATE OR REPLACE FUNCTION mark_expired_messages()
RETURNS INTEGER AS $$
DECLARE
  expiration_days INTEGER;
  deleted_count INTEGER;
BEGIN
  -- Get expiration days from config
  SELECT CAST(value AS INTEGER) INTO expiration_days
  FROM admin_config
  WHERE key = 'message_expiration_days';

  -- Mark messages as deleted if trade completed + expiration_days ago
  WITH expired_messages AS (
    UPDATE messages m
    SET deleted_at = NOW()
    FROM trades t
    WHERE m.trade_id = t.id
      AND m.deleted_at IS NULL
      AND t.status = 'completed'
      AND t.completed_at < (NOW() - (expiration_days || ' days')::INTERVAL)
    RETURNING m.id
  )
  SELECT COUNT(*) INTO deleted_count FROM expired_messages;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

/*
==================================================
FILE 2: Update chat service to exclude deleted messages
==================================================
*/

// filepath: src/services/chat.ts (UPDATE)

export async function getMessages(tradeId: string): Promise<Message[]> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        users!sender_id(first_name, profile_image_url)
      `)
      .eq('trade_id', tradeId)
      .is('deleted_at', null) // Exclude deleted messages
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((msg) => ({
      ...msg,
      sender: msg.users,
    }));
  } catch (error) {
    console.error('Get messages error:', error);
    return [];
  }
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Admin config for expiration days
✓ Function to mark expired messages
✓ Soft delete (deleted_at timestamp)
✓ Deleted messages excluded from queries
✓ Expiration based on trade completion date

==================================================
NEXT TASK
==================================================

MSG-005: Create database trigger for auto-deletion
*/
```

### Time Breakdown: **~2 hours**

---

## TASK MSG-005: Create Database Trigger to Auto-Delete Expired Messages

**Duration:** 1.5 hours  
**Priority:** Low  
**Dependencies:** MSG-004 (Message expiration)

### Description
Create scheduled job (pg_cron) to run message expiration function daily. Alternative: create Edge Function triggered by cron. Clean up old messages automatically.

---

### AI Prompt for Cursor (Generate Auto-Delete Trigger)

```typescript
/*
TASK: Set up automated message deletion

CONTEXT:
Run expiration function daily to clean up old messages.
Use pg_cron or Supabase Edge Function.

REQUIREMENTS:
1. Schedule daily job to run mark_expired_messages()
2. Log deletion count
3. Handle errors gracefully

FILE: supabase/migrations/027_message_cleanup_job.sql
- Create pg_cron job (if supported)

FILE: supabase/functions/cleanup-messages/index.ts
- Edge Function for message cleanup
- Run mark_expired_messages()
- Log results
*/
```

### Time Breakdown: **~1.5 hours**

---

## TASK MSG-006: Implement Push Notifications for New Messages

**Duration:** 3.5 hours  
**Priority:** High  
**Dependencies:** MSG-001 (Realtime chat), INFRA-011 (Expo Push)

### Description
Send push notifications when user receives new message. Use Expo Push Notifications for in-app delivery. Fallback to AWS SNS for SMS if app not open. Include sender name and message preview in notification.

---

### AI Prompt for Cursor (Generate Message Push Notifications)

```typescript
/*
TASK: Add push notifications for new messages

CONTEXT:
Notify users when they receive messages.
Expo Push for in-app, AWS SNS for SMS fallback.

REQUIREMENTS:
1. Trigger notification on message insert
2. Send Expo Push Notification
3. Include sender name and preview
4. Fallback to SMS if push fails
5. Deep link to chat screen

==================================================
FILE 1: Database trigger for notifications
==================================================
*/

-- filepath: supabase/migrations/028_message_notifications.sql

-- Function to send message notification
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Call Edge Function to send notification
  PERFORM net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-message-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
    ),
    body := jsonb_build_object(
      'message_id', NEW.id,
      'trade_id', NEW.trade_id,
      'sender_id', NEW.sender_id,
      'content', NEW.content
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on message insert
CREATE TRIGGER on_message_insert
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

/*
==================================================
FILE 2: Edge Function for notifications
==================================================
*/

// filepath: supabase/functions/send-message-notification/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const { message_id, trade_id, sender_id, content } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get trade details
    const { data: trade } = await supabaseClient
      .from('trades')
      .select(`
        buyer_id,
        seller_id,
        users!buyer_id(first_name),
        seller:users!seller_id(first_name)
      `)
      .eq('id', trade_id)
      .single();

    if (!trade) throw new Error('Trade not found');

    // Determine recipient
    const recipientId = sender_id === trade.buyer_id ? trade.seller_id : trade.buyer_id;

    // Get recipient's push token
    const { data: recipient } = await supabaseClient
      .from('users')
      .select('expo_push_token, phone')
      .eq('id', recipientId)
      .single();

    if (!recipient) return new Response('Recipient not found', { status: 404 });

    // Get sender name
    const { data: sender } = await supabaseClient
      .from('users')
      .select('first_name')
      .eq('id', sender_id)
      .single();

    const senderName = sender?.first_name || 'Someone';
    const messagePreview = content.substring(0, 100);

    // Send Expo Push Notification
    if (recipient.expo_push_token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: recipient.expo_push_token,
          title: `New message from ${senderName}`,
          body: messagePreview,
          data: {
            screen: 'Chat',
            tradeId: trade_id,
          },
        }),
      });
    }

    // TODO: Fallback to SMS if no push token or push fails

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Push notification sent on new message
✓ Includes sender name and preview
✓ Deep link to chat screen
✓ Trigger on message insert
✓ SMS fallback (TODO)

==================================================
NEXT TASK
==================================================

MSG-007: Implement email notifications for messages
*/
```

### Time Breakdown: **~3.5 hours**

---

## TASK MSG-007: Implement Email Notifications for New Messages

**Duration:** 2 hours  
**Priority:** Low  
**Dependencies:** MSG-001 (Realtime chat), INFRA-010 (SendGrid)

### Description
Send email notifications for new messages using SendGrid. Only send if user hasn't read message within configurable time (e.g., 1 hour). Include message preview and link to chat. Respect user email preferences.

---

### AI Prompt for Cursor (Generate Email Notifications)

```typescript
/*
TASK: Add email notifications for unread messages

CONTEXT:
Email users if they don't read messages within X hours.
Use SendGrid (free tier: 100 emails/day).

REQUIREMENTS:
1. Check if message unread after X hours
2. Send email with message preview
3. Include link to chat
4. Respect user email preferences

FILE: supabase/functions/send-message-email/index.ts
- Edge Function for email notifications
- Query unread messages > X hours old
- Send SendGrid email
- Mark as email_sent

FILE: supabase/migrations/029_message_email_tracking.sql
- Add email_sent_at column to messages
*/
```

### Time Breakdown: **~2 hours**

---

## TASK MSG-008: Implement Message Delivery Status Tracking (Deferred to Post-MVP)

**Duration:** 3 hours (deferred)  
**Priority:** Low  
**Dependencies:** MSG-001 (Realtime chat)

### Description
Track message delivery status: sent, delivered, read. Display status indicators (single/double check marks). Update status in real-time. **Deferred to Post-MVP.**

---

### AI Prompt for Cursor (Generate Delivery Status Tracking)

```typescript
/*
TASK: Add message delivery status (DEFERRED TO POST-MVP)

CONTEXT:
WhatsApp-style delivery indicators.
Single check = sent, double = delivered, blue = read.

REQUIREMENTS:
1. Add status column to messages
2. Update status on message view
3. Display check marks in UI
4. Real-time status updates

NOTE: This task is deferred to Post-MVP
*/
```

### Time Breakdown: **~3 hours** (deferred)

---

## TASK MSG-009: Implement Typing Indicators (Deferred to Post-MVP)

**Duration:** 2 hours (deferred)  
**Priority:** Low  
**Dependencies:** MSG-001 (Realtime chat)

### Description
Show "User is typing..." indicator when other user is composing message. Use Supabase Realtime presence to broadcast typing status. Display typing indicator in chat header. **Deferred to Post-MVP.**

---

### AI Prompt for Cursor (Generate Typing Indicators)

```typescript
/*
TASK: Add typing indicators (DEFERRED TO POST-MVP)

CONTEXT:
Show when other user is typing.
Use Supabase Realtime presence.

REQUIREMENTS:
1. Broadcast typing state
2. Listen to presence updates
3. Display "User is typing..." indicator
4. Auto-hide after 3 seconds of inactivity

NOTE: This task is deferred to Post-MVP
*/
```

### Time Breakdown: **~2 hours** (deferred)

---

---

## MODULE 07 SUMMARY

**Total Tasks:** 9 (7 implemented + 2 deferred)  
**Estimated Time:** ~24.5 hours (19.5 hours implemented + 5 hours deferred)

### Task Breakdown

| Task | Description | Duration | Status |
|------|-------------|----------|--------|
| MSG-001 | Supabase Realtime chat (text) | 4h | ✅ Documented |
| MSG-002 | Chat UI (conversation list) | 3h | ✅ Documented |
| MSG-003 | Image sharing in chat | 3.5h | ✅ Documented |
| MSG-004 | Message expiration (30 days) | 2h | ✅ Documented |
| MSG-005 | Auto-delete trigger | 1.5h | ✅ Documented |
| MSG-006 | Push notifications | 3.5h | ✅ Documented |
| MSG-007 | Email notifications | 2h | ✅ Documented |
| MSG-008 | Delivery status tracking | 3h | ⏸️ Deferred |
| MSG-009 | Typing indicators | 2h | ⏸️ Deferred |

---

### Key Features

**Real-Time Messaging:**
- Supabase Realtime for instant message delivery
- Text and image messages
- Chronological message display
- Auto-scroll to latest

**Conversation Management:**
- Conversation list with last message preview
- Unread message count
- Navigate to chat screen
- Real-time conversation updates

**Media Sharing:**
- Image upload to Supabase Storage
- Inline image display
- Image preview/fullscreen
- Image compression

**Message Lifecycle:**
- Auto-delete after 30 days (configurable)
- Soft delete (deleted_at timestamp)
- Scheduled cleanup job

**Notifications:**
- Push notifications (Expo Push)
- Email notifications (SendGrid)
- SMS fallback (AWS SNS)
- Deep linking to chat

---

### Database Tables

1. **messages** - Chat messages with RLS
2. **Admin config:** `message_expiration_days`

---

### Supabase Storage

**Bucket:** `chat-images`
- User-uploaded chat images
- Auto-compression before upload
- Access via RLS policies

---

### External APIs

1. **Expo Push Notifications** - In-app message notifications
2. **SendGrid** - Email notifications (free tier: 100/day)
3. **AWS SNS** - SMS fallback notifications

---

### Cost Analysis

**Supabase Realtime:**
- Free tier: 200 concurrent connections
- **Estimated:** $0/month (under free tier)

**Expo Push Notifications:**
- Free (unlimited)

**SendGrid:**
- Free tier: 100 emails/day
- **Estimated:** $0/month

**AWS SNS:**
- $0.00645 per SMS
- **Estimated:** $0-50/month (fallback only)

**Total:** ~$0-50/month

---

### Security Considerations

**RLS Policies:**
- Users can only view messages from their trades
- Users can only send messages to their trades
- Users can only delete own messages

**Message Encryption:**
- Messages stored in plaintext (Post-MVP: add E2E encryption)
- TLS encryption in transit

**Image Moderation:**
- Reuse Google Vision API from ITEM-006
- Flag inappropriate images for review

---

### Analytics Events

1. `message_sent` - User sent message
2. `message_received` - User received message
3. `image_shared` - User shared image
4. `conversation_opened` - User opened chat
5. `notification_sent` - Push/email notification sent
6. `messages_expired` - Messages auto-deleted

---

### Testing Checklist

**Real-Time Chat:**
- [ ] Send text message → Appears immediately
- [ ] Receive message → Real-time update
- [ ] Messages display chronologically
- [ ] Auto-scroll to latest message

**Conversation List:**
- [ ] Shows all user's chats
- [ ] Last message preview displayed
- [ ] Unread count badge shown
- [ ] Tap conversation → Open chat

**Image Sharing:**
- [ ] Pick image → Upload to storage
- [ ] Image displays inline in chat
- [ ] Tap image → Fullscreen preview
- [ ] Image compressed before upload

**Message Expiration:**
- [ ] Messages expire after 30 days
- [ ] Deleted messages excluded from queries
- [ ] Cleanup job runs daily

**Notifications:**
- [ ] Push notification on new message
- [ ] Email sent after 1 hour unread
- [ ] Deep link opens chat screen
- [ ] SMS fallback works

---

### Future Enhancements (Post-MVP)

1. **Delivery Status Tracking** - Sent, delivered, read indicators
2. **Typing Indicators** - "User is typing..." display
3. **End-to-End Encryption** - Encrypt messages at rest
4. **Voice Messages** - Record and send audio
5. **File Attachments** - Share PDFs, documents
6. **Message Reactions** - Emoji reactions
7. **Message Search** - Search chat history
8. **Message Forwarding** - Forward messages to other chats

---

**MODULE 07: MESSAGING & CHAT - COMPLETE**

Ready to proceed to Module 08 (Reviews & Ratings)?
