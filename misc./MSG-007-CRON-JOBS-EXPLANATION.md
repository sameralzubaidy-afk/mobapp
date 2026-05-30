# Why We Need Cron Jobs for Email Notifications (MSG-007)

## Executive Summary

Cron jobs for email notifications are **mandatory architectural decision** for MSG-007 to handle asynchronous, batched email delivery outside the message insert transaction. This document explains the technical rationale.

---

## Problem Statement

### ❌ Wrong Approach: Synchronous Email on Message Insert

If we tried to send emails **immediately** when a message is received:

```sql
-- Bad: Blocks message insert transaction
CREATE FUNCTION notify_message_email()
RETURNS TRIGGER AS $$
BEGIN
  -- ❌ Synchronous HTTP call blocks transaction
  SELECT http_post(
    'https://api.sendgrid.com/v3/mail/send',
    jsonb_build_object(...),
    headers := jsonb_build_object(...)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Problems with synchronous approach:**
1. **User perceives lag**: Message insert takes 2-3 extra seconds waiting for SendGrid API
2. **Transaction failures**: If email API is down, message insert fails (data loss risk)
3. **Rate limiting**: SendGrid API calls are throttled; rapid message inserts = blocked requests
4. **Poor UX**: "Sending..." spinner appears for too long
5. **Resource contention**: Blocks Supabase connection pool slots

### ✅ Right Approach: Asynchronous Cron + Batching

**With cron jobs:**

```
Time    Event                                   Action
----    -----                                   ------
00:00   Message received (Bob sends to Alice)   ✓ Stored in 0.05s
        - delivery_status: 'sent'
        - email_sent_at: NULL

01:00   Cron job runs hourly                    🔍 Query unread messages
        get_unread_messages_for_email()         📧 Batch send emails
        - Finds 100 unread messages             ✓ Mark email_sent_at
        - Groups by recipient                   ✓ Rate-limited (100/day)
        - Batch API call

Next    Alice gets email notification           📬 Reads email with
hour    + link to chat                          deep link to chat
```

---

## Technical Rationale

### 1️⃣ **Decoupling Write from Communication**

**Principle**: Application data writes ≠ External notifications

```
Data Tier        Communication Tier
├─ Message       ├─ Push notification (immediate, 3x retry)
├─ Ledger        ├─ Email (delayed, daily batching)
├─ Wallet        └─ SMS (rate-limited by provider)
└─ Transaction

Cron ensures Communication Tier doesn't block Data Tier
```

**Why this matters:**
- Message insert completes in **<50ms** (no external I/O)
- Email sending is independent and can retry
- Push notifications fail → doesn't affect message storage

### 2️⃣ **Provider Rate Limiting**

SendGrid free tier: **100 emails/day max**

**Without batching:**
```
Scenario: Busy Saturday afternoon
10:00am  5 messages in → 5 immediate HTTP calls
10:05am  8 messages in → 8 more HTTP calls
...
11:00am  RATE LIMIT EXCEEDED (quota exceeded)
         All subsequent emails FAIL silently
         Users don't receive notifications all day ❌
```

**With hourly cron + batching:**
```
Scenario: Same 100 messages received randomly throughout day
11:00am  Cron runs → finds all unread
         Single batch query + grouped sending
         ✓ Respects rate limit
         ✓ Predictable quota consumption
         ✓ Can notify admin if approaching limit
```

### 3️⃣ **Cost Optimization**

**Email API costs scale with request count, not message count.**

| Approach | 100 Messages | Cost | Notes |
|----------|-------------|------|-------|
| **Synchronous** | 100 HTTP calls | 100 API units (expensive) | Multiple calls + retries = 150+ actual calls |
| **Cron batch** | 1-2 HTTP calls | 1-2 API units | Single call with 100 recipients, or 2 calls if grouped by region |

**Annual savings with cron batching:**
- SendGrid Business: $50/month (standard)
- Cron approach uses ~1-2% of typical usage
- Synchronous approach uses ~20% of typical usage
- **Annual savings: ~$100-150** (small, but accumulates)

### 4️⃣ **Graceful Degradation**

**If email service fails:**

```
Cron Approach:
├─ Cron job runs
├─ SendGrid API timeout
├─ Log error: "SendGrid down at 11:00am UTC"
├─ Mark messages for retry (email_sent_at remains NULL)
└─ Next cron run will retry (exponential backoff)
   ✓ Users still see messages in chat
   ✓ Email is just delayed

Synchronous Approach:
├─ Message received
├─ Trigger calls SendGrid
├─ SendGrid timeout
├─ ERROR on message insert
├─ ❌ User cannot see their message for 30+ seconds
└─ User experience is broken
```

### 5️⃣ **Observability & Debugging**

**Cron jobs create audit trail:**

```sql
SELECT 
  sent_batch_date,
  recipient_count,
  success_count,
  error_count,
  avg_send_time_ms,
  quota_remaining
FROM email_send_logs
WHERE sent_batch_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY sent_batch_date DESC;
```

**With cron, we know:**
- Exactly how many emails were sent each day
- Which users didn't receive emails (retry targets)
- SendGrid quota status
- Cost per user per day

**Without cron (synchronous):**
- Scattered logs across message insert triggers
- Hard to trace which emails were sent
- No batch visibility

---

## Architecture: How Cron Jobs Work

### Phase 1: Message Arrives (Immediate, ~50ms)

```typescript
// ChatScreen.tsx
const result = await sendMessage({
  tradeId: 'trade-123',
  senderId: 'alice-001',
  content: 'Still interested?',
});

// Edge Function: send-message/index.ts
const { data, error } = await supabase
  .from('messages')
  .insert({
    trade_id: tradeId,
    sender_id: senderId,
    content,
    delivery_status: 'sent',
    email_sent_at: null,  // ← Will be set by cron later
    created_at: now(),
  })
  .select()
  .single();

// ✓ Message stored in ~50ms
// ✓ No email sent yet
```

### Phase 2: Cron Job Runs (Hourly, Background)

**Cron schedule:** `0 * * * *` (every hour)

**Cron function:** `supabase/functions/send-message-email/index.ts`

```typescript
// Called by Supabase Scheduler or external service
// Runs at: 00:00, 01:00, 02:00, ..., 23:00 UTC

export async function handleCronEmailJob() {
  // Step 1: Find unread messages without emails sent
  const { data: unreadMessages } = await supabase.rpc(
    'get_unread_messages_for_email',
    {
      p_delay_hours: 1, // Don't send emails for messages < 1 hour old
    }
  );

  if (!unreadMessages?.length) {
    console.log('No unread messages to email');
    return { success: true, sent: 0 };
  }

  // Step 2: Group by recipient
  const grouped = groupBy(unreadMessages, 'recipient_id');

  // Step 3: Send batch emails to SendGrid
  let sentCount = 0;
  for (const [recipientId, messages] of Object.entries(grouped)) {
    const { error: sendError } = await sendgrid.send({
      to: recipientUser.email,
      templateId: 'd-messaging-unread-notification',
      dynamicTemplateData: {
        recipientName: recipientUser.name,
        messageCount: messages.length,
        latestSender: messages[0].sender_name,
        messagePreview: messages[0].content.substring(0, 100),
        tradeLink: `https://app.example.com/chat/${messages[0].trade_id}`,
      },
    });

    if (!sendError) {
      sentCount++;
      
      // Step 4: Mark emails as sent (prevent duplicate sends)
      await supabase.rpc('mark_message_email_sent', {
        p_message_ids: messages.map(m => m.id),
      });
    }
  }

  console.log(`Sent ${sentCount} email notifications`);
  return { success: true, sent: sentCount };
}
```

### Phase 3: User Receives Email

```
To: alice@example.com
Subject: You have 3 unread messages
From: noreply@kids-marketplace.com

┌─────────────────────────────────────────┐
│ 📬 You have unread messages             │
├─────────────────────────────────────────┤
│ Bob sent you 3 messages                 │
│                                         │
│ Latest message:                         │
│ "Still interested in the item?"         │
│                                         │
│ [Open Chat]  ← Deep link                │
└─────────────────────────────────────────┘
```

---

## Configuration: How to Set Up Cron Jobs

### Option A: Supabase Postgres Cron (Built-in)

**Advantage:** No external dependencies

```sql
-- Run email job every hour
SELECT cron.schedule(
  'send-message-emails-hourly',
  '0 * * * *',  -- Every hour
  'SELECT send_unread_message_emails()'
);

-- Monitor scheduled jobs
SELECT * FROM cron.job;

-- View execution logs
SELECT * FROM cron.job_run_details
ORDER BY end_time DESC
LIMIT 10;
```

### Option B: Supabase Functions (Recommended for Kids Marketplace)

**Advantage:** Full control, integrates with SendGrid, easier to debug

1. Create a Supabase Function:
   ```bash
   supabase functions new send-message-email
   ```

2. Deploy:
   ```bash
   supabase functions deploy send-message-email
   ```

3. Set up external cron scheduler (GitHub Actions, EasyCron, etc.):
   ```yaml
   # .github/workflows/cron-email-notifications.yml
   name: Send Message Email Notifications
   on:
     schedule:
       - cron: '0 * * * *'  # Every hour
   jobs:
     send-emails:
       runs-on: ubuntu-latest
       steps:
         - run: |
             curl -X POST \
               https://your-supabase-project.functions.supabase.co/send-message-email \
               -H 'Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}' \
               -H 'Content-Type: application/json'
   ```

### Option C: Third-party Cron Service

**Examples:**
- EasyCron (free tier)
- Cron-job.org (free tier)
- AWS EventBridge

**Configuration:**
```
URL: https://your-app.supabase.co/functions/v1/send-message-email
Schedule: Every hour
Headers: Authorization: Bearer <ANON_KEY>
Timeout: 60 seconds
```

---

## Comparison: Cron vs. Real-time Email

| Aspect | Real-time (❌ Don't) | Cron Jobs (✓ Do) |
|--------|------------------|-----------|
| **Latency** | 2-3s delay per message | 0-60 min depending on schedule |
| **Rate limiting** | Can exceed quota | Batched, quota-aware |
| **UX impact** | Message appears slow | Message appears fast |
| **Cost** | Higher (many small calls) | Lower (few large calls) |
| **Reliability** | Coupled to message insert | Decoupled, retry-able |
| **Scalability** | Breaks at high volume | Handles millions |
| **Debugging** | Scattered in logs | Centralized logs |
| **User expectation** | Email = notification | Email = summary |

---

## Implementation Checklist for Kids Marketplace

- [x] Create `send-message-email` Edge Function
- [x] Add `get_unread_messages_for_email()` RPC function
- [x] Add `mark_message_email_sent()` RPC function
- [x] Add `email_sent_at` column to messages table
- [x] Add email config to `admin_config` table
  - `message_email_enabled` (boolean)
  - `message_email_delay_hours` (int, default 1)
- [ ] Deploy `send-message-email` function
- [ ] Set up cron scheduler (GitHub Actions recommended)
- [ ] Configure SendGrid API key
- [ ] Test email delivery (manual + automated)
- [ ] Monitor email quota usage
- [ ] Add alerting if emails fail for 24+ hours

---

## FAQ

### Q: Why not send emails immediately when message arrives?
**A:** See "Problem Statement" above. Main issues: blocks UX, fails if SendGrid is down, burns quota.

### Q: What if user reads message before email is sent?
**A:** Email still sends (user might have missed notification). Harmless. Alternative: check `read_at` before sending, but adds complexity.

### Q: What if cron job fails?
**A:** Messages stay in `email_sent_at = NULL` state. Next cron run will retry. Admin can monitor logs and manually trigger if needed.

### Q: Can we send emails more frequently (every 5 minutes)?
**A:** Yes, but trade-offs:
- More quota used (20x vs. hourly)
- More API calls (higher cost)
- Less batching benefit
- Minimal user experience improvement

**Recommendation:** Hourly is optimal for kids marketplace (not urgent like Slack).

### Q: What if SendGrid has a quota of 100/day but we have 200 unread messages?
**A:** Implement quota tracking:
```sql
-- Check quota before sending batch
SELECT remaining_quota FROM email_quota_tracker;

IF remaining_quota < batch_size THEN
  -- Send partial batch, defer rest to next cron run
  RAISE WARNING 'Email quota limit reached. Partial send.';
END IF;
```

Then alert admins to increase quota or adjust send frequency.

---

## Deployment Command

```bash
# Deploy the Edge Function
supabase functions deploy send-message-email --no-verify-jwt

# Set up cron via GitHub Actions
git add .github/workflows/cron-email-notifications.yml
git commit -m "Add cron job for message email notifications (MSG-007)"
git push origin main

# Verify cron job is running
curl -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  https://your-project.functions.supabase.co/send-message-email \
  -X POST

# Check function logs
supabase functions logs send-message-email
```

---

## Key Takeaway

**Cron jobs for email are not optional—they're a critical architectural decision to:**
1. ✓ Keep message sends fast (<100ms)
2. ✓ Stay within provider rate limits
3. ✓ Reduce costs
4. ✓ Degrade gracefully when services fail
5. ✓ Provide observability & debugging

This pattern is used by every major messaging platform (Gmail, Slack, Discord) for non-urgent notifications.
