# MODULE 07 VERIFICATION: MESSAGING & CHAT

**Module:** MODULE-07-MESSAGING  
**Total Tasks:** 9 (7 implemented + 2 deferred)  
**Estimated Time:** ~24.5 hours (19.5 hours implemented + 5 hours deferred)  
**Status:** ✅ Ready for Implementation

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

## DELIVERABLES CHECKLIST

### Database Migrations

- [ ] **025_messages.sql** - Messages table with RLS policies
  - messages table (id, trade_id, sender_id, content, message_type, image_url, created_at, deleted_at)
  - RLS policies for viewing and sending messages
  - Indexes on trade_id, sender_id, created_at
  - Trigger for updated_at timestamp

- [ ] **026_message_expiration.sql** - Message expiration configuration
  - Admin config: `message_expiration_days` (default: 30)
  - Function: `mark_expired_messages()`
  - Soft delete logic based on trade completion date

- [ ] **027_message_cleanup_job.sql** - Automated cleanup
  - pg_cron job for daily message cleanup
  - OR Supabase Edge Function for cleanup

- [ ] **028_message_notifications.sql** - Notification triggers
  - Function: `notify_new_message()`
  - Trigger on message insert
  - Calls Edge Function for notification delivery

### Backend Services

- [ ] **src/services/chat.ts** - Chat service with Realtime
  - `sendMessage()` - Send text message
  - `sendImageMessage()` - Send image message
  - `getMessages()` - Fetch messages (exclude deleted)
  - `subscribeToMessages()` - Realtime subscription
  - `unsubscribeFromMessages()` - Cleanup subscription
  - `uploadChatImage()` - Upload to Supabase Storage

- [ ] **supabase/functions/send-message-notification/index.ts** - Push notifications
  - Fetch trade and recipient details
  - Send Expo Push Notification
  - SMS fallback (AWS SNS) - TODO
  - Deep link to chat screen

- [ ] **supabase/functions/send-message-email/index.ts** - Email notifications
  - Query unread messages > X hours old
  - Send SendGrid email with preview
  - Mark as email_sent
  - Respect user preferences

- [ ] **supabase/functions/cleanup-messages/index.ts** - Scheduled cleanup
  - Run `mark_expired_messages()` function
  - Log deletion count
  - Handle errors gracefully

### Frontend Components

- [ ] **src/screens/chat/ChatScreen.tsx** - Real-time chat UI
  - Message list with auto-scroll
  - Text input with send button
  - Image picker and upload
  - Display text and image messages
  - Own vs. other message styling
  - Timestamp display

- [ ] **src/screens/chat/ConversationsListScreen.tsx** - Conversation list
  - List of user's active chats
  - Last message preview
  - Unread message count badge
  - Navigate to ChatScreen
  - Real-time updates for new messages

### Supabase Storage

- [ ] **chat-images bucket** - Image storage
  - Create bucket with RLS policies
  - Users can upload images for their trades
  - Auto-compression before upload

### Configuration

- [ ] **Admin config** - Message expiration days
  - Default: 30 days
  - Configurable via admin panel

---

## FEATURE FLOWS

### 1. Send Text Message Flow

**User Journey:**
1. User opens chat screen for trade
2. Types message in input field
3. Taps "Send" button
4. Message appears immediately in chat (optimistic update)
5. Message sent to Supabase via `sendMessage()`
6. Real-time update confirms delivery
7. Other user receives message via Realtime subscription
8. Push notification sent to other user (if app in background)

**Technical Steps:**
1. User types message → `inputText` state updated
2. Tap Send → Call `sendMessage(tradeId, userId, content)`
3. Insert message into `messages` table
4. Realtime subscription broadcasts insert event
5. Both clients receive new message and append to list
6. Auto-scroll to bottom
7. Database trigger calls `notify_new_message()`
8. Edge Function sends push notification

**Database Implications:**
- Insert into `messages` table
- RLS policies enforce trade participation
- Trigger sends notification
- Message stored with timestamp

---

### 2. Share Image in Chat Flow

**User Journey:**
1. User taps image picker button
2. Selects image from device
3. Image compressed before upload
4. Image uploaded to Supabase Storage
5. Message created with `image_url`
6. Image displays inline in chat
7. Other user sees image immediately
8. Tap image → Fullscreen preview

**Technical Steps:**
1. Tap image picker → Launch device picker
2. User selects image → Compress with image library
3. Upload to `chat-images` bucket via `uploadChatImage()`
4. Get public URL from storage
5. Call `sendImageMessage(tradeId, userId, imageUrl)`
6. Insert message with `message_type = 'image'`
7. Realtime broadcasts new image message
8. Display image using `<Image source={{ uri: imageUrl }}>`

**Database Implications:**
- Insert into `messages` table with `message_type = 'image'`
- `image_url` column populated
- RLS policies allow access to trade participants only

---

### 3. Message Expiration Flow

**User Journey:**
1. Trade completes → Messages remain accessible
2. 30 days after trade completion → Messages marked for deletion
3. Scheduled job runs daily → Marks expired messages
4. Deleted messages no longer appear in chat
5. Storage space freed up

**Technical Steps:**
1. Trade status set to `completed` → `completed_at` timestamp saved
2. Daily cron job runs `mark_expired_messages()` function
3. Function queries messages where:
   - `trade.status = 'completed'`
   - `trade.completed_at < NOW() - X days`
   - `messages.deleted_at IS NULL`
4. Sets `deleted_at = NOW()` for expired messages
5. `getMessages()` excludes messages where `deleted_at IS NOT NULL`

**Database Implications:**
- Soft delete (set `deleted_at` timestamp)
- Old messages remain in database but hidden
- Future: Hard delete after grace period

---

### 4. Push Notification Flow

**User Journey:**
1. User A sends message to User B
2. User B's app in background or closed
3. Push notification appears on User B's device
4. Notification shows sender name and message preview
5. User B taps notification → App opens to chat screen

**Technical Steps:**
1. Message inserted into `messages` table
2. Database trigger `on_message_insert` fires
3. Calls `notify_new_message()` function
4. Function calls Edge Function `/send-message-notification`
5. Edge Function:
   - Fetches trade details (buyer/seller)
   - Determines recipient (other party)
   - Gets recipient's `expo_push_token`
   - Sends push notification to Expo API
   - Includes deep link: `{ screen: 'Chat', tradeId }`
6. Expo delivers notification to device
7. User taps notification → App navigates to chat

**Database Implications:**
- Trigger on every message insert
- Edge Function queries `users` and `trades` tables
- Requires `expo_push_token` in `users` table

---

### 5. Email Notification Flow (Unread Messages)

**User Journey:**
1. User receives message but doesn't open app
2. After 1 hour, email notification sent
3. Email includes message preview and link to chat
4. User clicks link → Opens app to chat screen

**Technical Steps:**
1. Scheduled job runs hourly (or Edge Function via cron)
2. Query messages where:
   - Created > 1 hour ago
   - Not read (no read receipt in Post-MVP)
   - Email not sent (`email_sent_at IS NULL`)
3. For each unread message:
   - Fetch recipient email
   - Send email via SendGrid
   - Include message preview (first 100 chars)
   - Include deep link to chat
   - Set `email_sent_at = NOW()`
4. User receives email and clicks link

**Database Implications:**
- Add `email_sent_at` column to `messages` table
- Update column after email sent
- Query filters by `email_sent_at IS NULL`

---

## DATABASE SCHEMA VERIFICATION

### Messages Table

```sql
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
  email_sent_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT content_or_image CHECK (
    (message_type = 'text' AND content IS NOT NULL) OR
    (message_type = 'image' AND image_url IS NOT NULL)
  )
);
```

**Indexes:**
- `messages_trade_id_idx` - Fast lookup by trade
- `messages_sender_id_idx` - Fast lookup by sender
- `messages_created_at_idx` - Chronological sorting

**RLS Policies:**
- Users can view messages from their trades
- Users can send messages to their trades
- Users can delete own messages (soft delete)

---

### Admin Config

```sql
INSERT INTO admin_config (key, value, value_type, description)
VALUES (
  'message_expiration_days',
  '30',
  'number',
  'Days after trade completion before messages are deleted'
);
```

---

## TESTING CHECKLIST

### Unit Tests

- [ ] **chat.ts service tests**
  - `sendMessage()` - Creates message with correct fields
  - `getMessages()` - Excludes deleted messages
  - `subscribeToMessages()` - Returns Realtime channel
  - `uploadChatImage()` - Uploads to correct bucket

### Integration Tests

- [ ] **Real-time messaging**
  - Send message from User A → User B receives via Realtime
  - Message appears in chronological order
  - Auto-scroll to latest message

- [ ] **Image sharing**
  - Upload image → Stored in `chat-images` bucket
  - Image message created with correct URL
  - Image displays in chat UI

- [ ] **Message expiration**
  - Trade completes → Set `completed_at`
  - Run `mark_expired_messages()` after 30 days
  - Verify `deleted_at` set on expired messages
  - Deleted messages excluded from `getMessages()`

- [ ] **Push notifications**
  - Send message → Trigger fires
  - Edge Function called with message details
  - Push notification sent to Expo
  - Deep link navigates to chat screen

- [ ] **Email notifications**
  - Unread message > 1 hour old → Email sent
  - Email includes message preview
  - `email_sent_at` timestamp updated
  - Second email not sent for same message

### UI/UX Tests

- [ ] **ChatScreen**
  - Messages display chronologically
  - Own messages right-aligned (blue)
  - Other messages left-aligned (white)
  - Sender name shown for other messages
  - Timestamp displayed below each message
  - Auto-scroll to bottom on new message
  - Keyboard pushes input up (KeyboardAvoidingView)

- [ ] **ConversationsListScreen**
  - All user's chats listed
  - Last message preview shown
  - Unread count badge displayed
  - Tap conversation → Navigate to ChatScreen
  - Real-time update when new message arrives

- [ ] **Image messages**
  - Inline image display
  - Tap image → Fullscreen preview
  - Image aspect ratio preserved
  - Loading indicator while uploading

### RLS Policy Tests

- [ ] **Message visibility**
  - Trade participants can view messages
  - Non-participants cannot view messages
  - Deleted messages excluded from queries

- [ ] **Message creation**
  - Trade participants can send messages
  - Non-participants cannot send messages
  - Sender ID matches authenticated user

### Performance Tests

- [ ] **Chat loading**
  - Load 100+ messages → < 1 second
  - Smooth scrolling with large message list
  - Realtime subscriptions don't lag

- [ ] **Image upload**
  - Compress large images before upload
  - Upload < 5MB images in < 10 seconds
  - Progress indicator shown during upload

---

## EXTERNAL DEPENDENCIES

### Expo Push Notifications
- **Free tier:** Unlimited push notifications
- **Setup:** Obtain Expo push token on app launch
- **Store:** Save `expo_push_token` in `users` table
- **Docs:** https://docs.expo.dev/push-notifications/overview/

### SendGrid (Email)
- **Free tier:** 100 emails/day
- **Setup:** Get API key from SendGrid
- **Store:** Environment variable `SENDGRID_API_KEY`
- **Docs:** https://docs.sendgrid.com/

### AWS SNS (SMS Fallback - Optional)
- **Cost:** $0.00645 per SMS
- **Setup:** AWS account, SNS credentials
- **Store:** Environment variables `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- **Docs:** https://docs.aws.amazon.com/sns/

### Supabase Realtime
- **Free tier:** 200 concurrent connections
- **Setup:** Enable Realtime in Supabase dashboard
- **Docs:** https://supabase.com/docs/guides/realtime

### Supabase Storage
- **Free tier:** 1GB storage
- **Setup:** Create `chat-images` bucket
- **Policies:** RLS policies for upload/download
- **Docs:** https://supabase.com/docs/guides/storage

---

## COST ANALYSIS

**Supabase Realtime:**
- Free tier: 200 concurrent connections
- **Estimated:** $0/month (under free tier)

**Expo Push Notifications:**
- Free (unlimited)
- **Estimated:** $0/month

**SendGrid:**
- Free tier: 100 emails/day
- **Estimated:** $0/month

**AWS SNS (SMS Fallback):**
- $0.00645 per SMS
- Assume 10% of messages trigger SMS (fallback only)
- 1000 messages/day × 10% × 30 days = 3000 SMS/month
- **Estimated:** $19.35/month

**Supabase Storage:**
- Free tier: 1GB
- Assume 1000 images/month × 500KB avg = 500MB
- **Estimated:** $0/month (under free tier)

**Total:** ~$0-20/month (depending on SMS usage)

---

## SECURITY CONSIDERATIONS

**Message Privacy:**
- RLS policies enforce trade participation
- Non-participants cannot view messages
- Messages encrypted in transit (TLS)
- Post-MVP: End-to-end encryption

**Image Moderation:**
- Reuse Google Vision API from ITEM-006
- Flag inappropriate images
- Admin review flagged images

**Notification Content:**
- Don't include sensitive info in push notifications
- Message preview limited to 100 chars
- Deep link requires authentication

**Data Retention:**
- Auto-delete messages after 30 days
- Configurable by admin
- Soft delete (recoverable for 7 days)

---

## KNOWN LIMITATIONS & POST-MVP

**Deferred to Post-MVP:**
1. **MSG-008: Delivery Status Tracking** - Sent, delivered, read indicators
2. **MSG-009: Typing Indicators** - "User is typing..." display

**Future Enhancements:**
1. **End-to-End Encryption** - Encrypt messages at rest
2. **Voice Messages** - Record and send audio
3. **File Attachments** - Share PDFs, documents
4. **Message Reactions** - Emoji reactions
5. **Message Forwarding** - Forward to other chats
6. **Message Search** - Search chat history
7. **Message Pinning** - Pin important messages
8. **Chat Archiving** - Archive old conversations

**Known Issues:**
- Large message lists may impact performance (optimize with pagination)
- Image uploads on slow networks may timeout (add retry logic)
- Push notifications require Expo Go or standalone build (test on device)

---

## ANALYTICS & MONITORING

**Events to Track:**
1. `message_sent` - User sent message
2. `message_received` - User received message
3. `image_shared` - User shared image
4. `conversation_opened` - User opened chat
5. `notification_sent` - Push/email notification sent
6. `messages_expired` - Messages auto-deleted

**Metrics to Monitor:**
- Average messages per trade
- Message delivery rate
- Push notification open rate
- Email notification open rate
- Image share rate
- Message expiration count

---

## ROLLOUT PLAN

**Phase 1: Core Messaging (Week 1)**
- MSG-001: Supabase Realtime chat
- MSG-002: Conversation list UI
- Test with small user group

**Phase 2: Media & Expiration (Week 2)**
- MSG-003: Image sharing
- MSG-004: Message expiration
- MSG-005: Auto-delete trigger
- Test image uploads and cleanup

**Phase 3: Notifications (Week 3)**
- MSG-006: Push notifications
- MSG-007: Email notifications
- Test notification delivery

**Phase 4: Optimization (Week 4)**
- Performance tuning
- Bug fixes
- User feedback incorporation

---

## VERIFICATION COMPLETE ✅

**Ready for Implementation:** All tasks documented with clear requirements, acceptance criteria, and test plans.

**Next Steps:**
1. Review with team
2. Prioritize tasks (MVP vs. Post-MVP)
3. Assign to developers
4. Begin implementation with MSG-001

**Estimated Total Time:** ~19.5 hours for MVP (excludes deferred tasks)

---

**MODULE 07 VERIFICATION - COMPLETE**
