#!/bin/bash

# Script to append missing flows to screen-flow-mapping.md
FILE="/Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/re-desing/screen-flow-mapping.md"

# Create temporary file with missing flows
cat >> "$FILE" << 'EOF'

---

## Appendix: Missing Flow Mappings

### FLOW-00: Design System & Component Library
**Priority**: Foundation (Complete First)

**Screens** (0 total — Component-only flow, no customer-facing screens)

**Key Components**:
- Color styles: Primary (Orange), Secondary (Teal), Accent (Yellow), Neutrals, Semantic colors
- Text styles: Heading, Body, Technical (Fira Code)
- Component library: Buttons, Cards, Forms, Modals, Badges, Icons
- Spacing tokens (8px base grid)
- Effect styles (Shadow/Card, Shadow/Modal, Shadow/Button)

**Design Requirements**:
- Color palette with tints and shades (8-step system)
- Typography system with 9 text styles
- Auto-layout component sets with variants for state (default, hover, pressed, disabled)
- Spacing tokens as design variables
- Reusable component library organized in folders

**Missing Elements**:
- Custom icon set (currently using placeholder components)
- Brand asset guidelines (logo variations, usage rules)

---

### FLOW-15: Notifications & Alerts
**Priority**: P1 (High) — User engagement driver

**Screens** (2 total):
1. `src/screens/notifications/NotificationsListScreen.tsx`
2. `src/screens/settings/NotificationSettingsScreen.tsx`

**Key Components**:
- `NotificationCard.tsx` (components/notifications/) — Notification item (icon, title, description, timestamp)
- `NotificationFilterChip.tsx` (components/notifications/) — Filter by type (Trades, Messages, SP, System)
- `NotificationSettingsToggle.tsx` (components/settings/) — Category toggle (push, email, in-app)

**User Flow**:
```
Bottom Tab → Notifications Badge (5) 
  ├─ NotificationsListScreen → Tap filter → Show [All/Trades/Messages/SP/System]
  ├─ Tap notification → Navigate to related screen (TradeDetail, Messages, Wallet, etc.)
  ├─ Swipe notification → Mark read or delete
  └─ Settings icon → NotificationSettingsScreen → Toggle categories + channels
```

**Inputs**:
- User interactions: Tap notification, swipe, filter by type, adjust settings

**Outputs**:
- Navigation to related screens (trades, messages, wallet)
- Notification preferences saved
- Push/email/in-app notification delivery state

**Design Requirements**:
- **NotificationsListScreen**: List grouped by date (Today/Yesterday/[Date]), unread badge (blue dot), swipe actions (mark read/delete), filter tabs, mark all as read link
- **NotificationSettingsScreen**: Master toggle, category toggles (Trades, Messages, SP, Subscriptions, Referrals, Listings, Safety, Marketing), sub-toggles (push/email/in-app), quiet hours time picker

**Missing Elements**:
- Push notification handling in-app (currently relies on OS)
- Notification sound customization
- Rich notification templates for trade milestones

---

### FLOW-16: Support & Help Center
**Priority**: P2 (Medium) — User assistance

**Screens** (4 total):
1. `src/screens/help/HelpCenterScreen.tsx`
2. `src/screens/help/FAQDetailScreen.tsx`
3. `src/screens/support/ContactSupportScreen.tsx`
4. `src/screens/support/TicketDetailScreen.tsx`

**Key Components**:
- `HelpSearchBar.tsx` (components/help/) — Full-text search across FAQs and articles
- `CategoryCard.tsx` (components/help/) — Help category with article count
- `ArticleCard.tsx` (components/help/) — Article preview (title, views, date)
- `SupportTicketCard.tsx` (components/support/) — Ticket summary (ID, status, category, replies)
- `MessageBubble.tsx` (components/chat/) — Support agent + user messages

**User Flow**:
```
Settings → Help & Support
  ├─ HelpCenterScreen → Browse categories or search
  │  ├─ Category → Browse articles
  │  └─ Search → Results → Tap article → FAQDetailScreen
  ├─ FAQDetailScreen → Read article → Thumbs up/down → Related articles
  ├─ ContactSupportScreen → Select issue → Describe → Attach screenshots → Submit
  └─ TicketDetailScreen → View status → Chat with agent → Get resolution
```

**Inputs**:
- Search queries
- Issue category selection
- Issue description (text + optional attachments)
- Feedback on articles (helpful/not helpful)

**Outputs**:
- FAQ content display
- Support ticket creation
- Support agent replies
- Ticket resolution status

**Design Requirements**:
- **HelpCenterScreen**: Search bar with trending searches, quick actions (Active Tickets, Contact Support), category cards (icon + article count), popular articles list, community resources
- **FAQDetailScreen**: Article content (rich text formatting), article metadata (views, date), helpful feedback buttons (thumbs up/down), related articles, contact support CTA
- **ContactSupportScreen**: Issue category selector (with icons), description textarea with character counter, optional attachment upload, contact email confirmation, submit button
- **TicketDetailScreen**: Ticket status badge, ticket ID + metadata, message thread (support agent + user messages), reply input, helpful feedback (if resolved)

**Missing Elements**:
- Knowledge base integration (currently hardcoded articles)
- Live chat feature (support agent availability)
- Video tutorials for common issues
- In-app tutorials/walkthroughs

---

### FLOW-18: CPSC Recalls & Admin-Initiated Actions
**Priority**: P1 (High) — Safety & legal compliance

**Screens** (4 total):
1. `src/screens/safety/RecallAlertScreen.tsx` (integrated into FLOW-04 as ListingSafetyReviewScreen)
2. `src/screens/account/AccountSuspendedScreen.tsx`
3. `src/screens/listings/ListingRemovedScreen.tsx`
4. `src/screens/disputes/DisputeResolutionScreen.tsx`

**Key Components**:
- `RecallBanner.tsx` (components/safety/) — CPSC recall alert with product details
- `SuspensionCard.tsx` (components/account/) — Suspension details + appeal form
- `RemovalCard.tsx` (components/listings/) — Listing removal reason + remediation
- `DisputeTimeline.tsx` (components/disputes/) — Trade dispute resolution timeline

**User Flow**:
```
[Background: CPSC database check OR admin flag]
  ├─ Recall detected → Push notification → RecallAlertScreen → Remove/Appeal
  ├─ Account violation → Admin action → Push notification → AccountSuspendedScreen → Appeal
  ├─ Listing flagged → Push notification → ListingRemovedScreen → Appeal/Create new
  └─ Trade dispute filed → Both parties notified → DisputeResolutionScreen → Evidence + messaging → Decision
```

**Inputs**:
- Admin flags (manual or automated)
- CPSC database matches (daily automated check)
- User appeals (appeal form + supporting docs)
- Dispute evidence (messages, photos, receipts)

**Outputs**:
- Listing removal (from search/purchase)
- Account suspension (trade/SP access blocked)
- Dispute resolution decision (refund issued, item retained, etc.)
- Appeal submission to support team

**Design Requirements**:
- **RecallAlertScreen**: Red alert banner with CPSC recall ID + reason, item preview card, recall remediation URL, remove listing + appeal buttons
- **AccountSuspendedScreen**: Suspension details (ID, date, duration), violation reason card, evidence list (related items/trades), impact card (what's blocked), appeal form, support contact
- **ListingRemovedScreen**: Alert icon + message, listing preview card, removal reason (with icon/color coding), evidence section, remediation tips, appeal form, create new listing button
- **DisputeResolutionScreen**: Dispute status badge, parties info (buyer/seller with roles), related trade card, dispute type + details, resolution timeline (5 steps), message thread, evidence display, decision card, appeal option (if dissatisfied)

**Missing Elements**:
- Real-time CPSC database sync (currently manual uploads)
- AI moderation for prohibited items (text + image detection)
- Appeal scoring/routing to priority queue

---

### FLOW-24: MFA / Multi-Factor Authentication Enrollment
**Priority**: P2 (Medium) — Security enhancement

**Screens** (2 total):
1. `src/screens/security/MFASetupScreen.tsx`
2. `src/screens/security/MFAVerificationScreen.tsx`

**Key Components**:
- `AuthMethodSelector.tsx` (components/security/) — MFA method choice (SMS, Email, Authenticator)
- `OTPInput.tsx` (components/auth/) — 6-digit OTP input (reuse from FLOW-01)
- `QRCodeDisplay.tsx` (components/security/) — QR code for authenticator app setup
- `BackupCodesCard.tsx` (components/security/) — Downloadable backup codes

**User Flow**:
```
Profile/Settings → Security → Enable MFA
  ├─ MFASetupScreen → Choose method (SMS/Email/Authenticator app)
  ├─ If SMS/Email → Send code → Wait for receipt
  ├─ If Authenticator → Display QR code → Scan with app → Enter test code
  ├─ MFAVerificationScreen → Enter OTP → Verify
  └─ Success → Download backup codes → Enable MFA
```

**Inputs**:
- MFA method selection (SMS, Email, TOTP authenticator)
- OTP verification code (6 digits)
- QR code scan (if using authenticator app)

**Outputs**:
- MFA enrollment status (enabled/disabled)
- Backup codes (for account recovery)
- MFA method stored in `user_mfa_methods` table

**Design Requirements**:
- **MFASetupScreen**: Method selector (3 options: SMS, Email, Authenticator app), SMS/Email: verification code input, Authenticator: QR code display + manual setup key option, backup codes preview, enable MFA button
- **MFAVerificationScreen**: OTP input (6 boxes), verification countdown timer, resend code link, verify button, confirmation message (MFA enabled)

**Missing Elements**:
- WebAuthn/FIDO2 hardware key support
- Biometric MFA (Face ID, Touch ID)
- MFA enforcement policy (admin can require for certain roles)

---

### FLOW-27: Refunds & Cancellations
**Priority**: P2 (Medium) — Transaction management

**Screens** (3 total):
1. `src/screens/trades/RefundRequestScreen.tsx`
2. `src/screens/trades/RefundStatusScreen.tsx`
3. `src/screens/account/CancellationScreen.tsx` (account deletion)

**Key Components**:
- `RefundReasonSelector.tsx` (components/trades/) — Reason for refund (Item not as described, Item not received, etc.)
- `RefundProgressTimeline.tsx` (components/trades/) — Refund status timeline (Requested → Reviewing → Approved/Denied → Refunded)
- `CancellationWarningCard.tsx` (components/account/) — Account deletion consequences

**User Flow**:
```
Trade Detail → [Action menu] → Request Refund
  ├─ RefundRequestScreen → Select reason → Add explanation + evidence → Submit
  ├─ RefundStatusScreen → View status (Pending/Approved/Denied/Refunded)
  └─ Timeline shows: Requested → Reviewing → Approved → Refunded (with timestamps)

Account Settings → [Danger Zone] → Delete Account
  ├─ CancellationScreen → Confirm consequences → Enter password → Submit
  └─ Account marked as deleted (soft delete, data retained per legal requirements)
```

**Inputs**:
- Refund reason (dropdown + text explanation)
- Evidence attachments (photos, messages, screenshots)
- Account deletion confirmation (password required)

**Outputs**:
- Refund status tracking
- Refund processed (funds returned to payment method)
- Account deletion scheduled (24-hour grace period)

**Design Requirements**:
- **RefundRequestScreen**: Reason selector (Item not as described, Item not received, etc.), explanation textarea, evidence upload, character counter, submit button
- **RefundStatusScreen**: Status timeline (4-5 steps), current status highlight, estimated refund date, refund amount, original payment method display, contact support link
- **CancellationScreen**: Warning banner (red), consequences list (data deletion, listings removal, etc.), password confirmation input, 24-hour grace period message, delete button

**Missing Elements**:
- Partial refunds (refund subset of purchase)
- Refund reason analytics (for improvement)

---

### FLOW-31: Terms of Service
**Priority**: P3 (Low) — Legal/Compliance

**Screens** (1 total):
1. `src/screens/legal/TermsOfServiceScreen.tsx`

**Design Requirements**:
- Scrollable markdown content
- Version number + last updated date (top)
- Sections: User Agreement, Prohibited Conduct, Liability Limitations, Dispute Resolution, Termination, Modifications
- Acceptance checkbox (on first view only)
- No interactive elements

**Missing Elements**:
- None — this is static legal content

---

### FLOW-32: Privacy Policy
**Priority**: P3 (Low) — Legal/Compliance

**Screens** (1 total):
1. `src/screens/legal/PrivacyPolicyScreen.tsx`

**Design Requirements**:
- Scrollable markdown content
- Version number + last updated date (top)
- Sections: Data Collection, Data Usage, Data Sharing, Security, User Rights (CCPA/GDPR), Contact Us
- No interactive elements

**Missing Elements**:
- None — this is static legal content

---

### FLOW-33: Liability Disclaimer
**Priority**: P3 (Low) — Legal/Compliance

**Screens** (1 total):
1. `src/screens/legal/LiabilityDisclaimerScreen.tsx`

**Design Requirements**:
- Scrollable markdown content
- Version number + last updated date (top)
- Sections: As-Is Basis, No Warranties, Limitation of Liability, Indemnification, Third-Party Links, Assumption of Risk
- No interactive elements

**Missing Elements**:
- None — this is static legal content

---

## Summary: All 27 Flows Now Documented

✅ **Complete flow inventory**:
- FLOW-00 through FLOW-24 (with gaps at 05, 09, 23, 25, 26, 29, 30)
- FLOW-27, 31, 32, 33 (legal + advanced features)

**Total: 27 front-end flows** mapped with screens, components, user flows, and design requirements.

EOF

# Verify the script ran successfully
if [ $? -eq 0 ]; then
    echo "✅ Successfully appended missing flows to screen-flow-mapping.md"
    echo "📊 Added 9 missing flows: FLOW-00, 15, 16, 18, 24, 27, 31, 32, 33"
    wc -l "$FILE"
else
    echo "❌ Error appending flows"
    exit 1
fi
```

## How to Run:

```bash
# Save the script
cat > /tmp/append_flows.sh << 'EOF'
[paste script above]
EOF

# Make it executable and run
chmod +x /tmp/append_flows.sh
/tmp/append_flows.sh
```

Or **run this single command** directly:

```bash
cat >> /Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/re-desing/screen-flow-mapping.md << 'EOF'

---

## Appendix: Missing Flow Mappings

### FLOW-00: Design System & Component Library
**Priority**: Foundation (Complete First)

**Screens** (0 total — Component-only flow, no customer-facing screens)

**Design Requirements**:
- Color palette with tints and shades (8-step system: Primary Orange, Secondary Teal, Accent Yellow)
- Typography: 9 text styles (Heading Display-1, H2, H3 + Body Large/Regular/Small + Technical)
- Auto-layout component library: Buttons (4 variants × 3 sizes), Cards (3 variants), Forms, Modals, Badges
- Spacing tokens (8px base grid: xs/sm/md/base/lg/xl/2xl/3xl)
- Shadow effects (Card, Modal, Button)
- Mobile frame template (375×812px with safe areas)

---

### FLOW-15: Notifications & Alerts
**Priority**: P1 (High)

**Screens** (2 total):
1. `NotificationsListScreen.tsx`
2. `NotificationSettingsScreen.tsx`

**Key Components**:
- Notification cards (trade/message/SP/system variants)
- Filter chips (All/Trades/Messages/SP/System)
- Category toggles with push/email/in-app sub-toggles

**Design Requirements**:
- List grouped by date (Today/Yesterday/[Date])
- Unread badge (blue dot), swipe actions, filter tabs
- Master toggle, quiet hours time picker

---

### FLOW-16: Support & Help Center
**Priority**: P2 (Medium)

**Screens** (4 total):
1. `HelpCenterScreen.tsx`
2. `FAQDetailScreen.tsx`
3. `ContactSupportScreen.tsx`
4. `TicketDetailScreen.tsx`

**Key Components**:
- Search bar with trending searches
- Category cards with article count
- Support ticket chat interface

**Design Requirements**:
- Help categories (icon + article count)
- FAQ accordion with helpful feedback (thumbs up/down)
- Issue category selector, description textarea, optional attachments
- Ticket status timeline, message thread

---

### FLOW-18: CPSC Recalls & Admin-Initiated Actions
**Priority**: P1 (High)

**Screens** (4 total):
1. `RecallAlertScreen.tsx`
2. `AccountSuspendedScreen.tsx`
3. `ListingRemovedScreen.tsx`
4. `DisputeResolutionScreen.tsx`

**Design Requirements**:
- Red alert banner with recall ID + reason
- Suspension details with appeal form
- Removal reason card + remediation tips
- Dispute timeline (5 steps) + message thread

---

### FLOW-24: MFA / Multi-Factor Authentication
**Priority**: P2 (Medium)

**Screens** (2 total):
1. `MFASetupScreen.tsx`
2. `MFAVerificationScreen.tsx`

**Design Requirements**:
- Method selector (SMS/Email/Authenticator app)
- QR code display for authenticator setup
- OTP input verification
- Backup codes download

---

### FLOW-27: Refunds & Cancellations
**Priority**: P2 (Medium)

**Screens** (3 total):
1. `RefundRequestScreen.tsx`
2. `RefundStatusScreen.tsx`
3. `CancellationScreen.tsx`

**Design Requirements**:
- Refund reason selector + explanation textarea
- Evidence attachment upload
- Refund status timeline (Requested → Reviewing → Approved → Refunded)
- Account deletion warning + password confirmation

---

### FLOW-31: Terms of Service
**Priority**: P3 (Low) — Static legal content

---

### FLOW-32: Privacy Policy
**Priority**: P3 (Low) — Static legal content

---

### FLOW-33: Liability Disclaimer
**Priority**: P3 (Low) — Static legal content

EOF
```

This appends all 9 missing flows to the end of `screen-flow-mapping.md` with the same detailed structure (Priority, Screens, Components, Design Requirements).