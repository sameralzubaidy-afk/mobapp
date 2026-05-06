# Flow Coverage Analysis: Figma Prompts vs Flow Registry
**Analysis Date:** May 4, 2026  
**Purpose:** Cross-check figma-agent-prompts.md against flow-registry.md to identify missing customer-facing flows

---

## ✅ FLOWS COVERED IN FIGMA-AGENT-PROMPTS.MD (18 flows)

| Flow ID | Flow Name | Screens | Status |
|---------|-----------|---------|--------|
| FLOW-00 | Design System & Component Library | Components | ✅ Complete |
| FLOW-01 | Authentication | 7 screens | ✅ Complete |
| FLOW-02 | Profiles & Onboarding | 5 screens | ✅ Complete |
| FLOW-03 | Node/ZIP Gating | 2 screens | ✅ Complete |
| FLOW-04 | Listing Management | 5 screens | ✅ Complete |
| FLOW-05 | Media Upload | Integrated | ✅ Complete |
| FLOW-06 | Discovery | 3 screens | ✅ Complete |
| FLOW-07 | Cart & Bundling | 2 screens | ✅ Complete (NEW) |
| FLOW-08 | Trade Flow | 6 screens | ✅ Complete |
| FLOW-09 | Fees & Pricing Engine | Integrated | ✅ Complete |
| FLOW-10 | SP Wallet | 3 screens | ✅ Complete |
| FLOW-11 | SP Earn/Spend Logic | Integrated | ✅ Complete |
| FLOW-12 | Subscription Management | 4 screens | ✅ Complete |
| FLOW-13 | Messaging & Coordination | 3 screens | ✅ Complete |
| FLOW-14 | Referral Program | 2 screens | ✅ Complete |
| FLOW-15 | Notifications & Alerts | 3 screens | ✅ Complete |
| FLOW-16 | Support & Help Center | 4 screens | ✅ Complete |
| FLOW-17 | Subscription Events | 3 screens | ✅ Complete |
| FLOW-18 | CPSC Recalls & Admin Actions | 4 screens | ✅ Complete |

**Total: 68+ screens designed across 18 flows**

---

## ⚠️ CUSTOMER-FACING FLOWS MISSING FROM FIGMA PROMPTS

### **FLOW-19: Trading Education (MODULE-18 V1)**
**Priority:** P1 (High) — First-time user onboarding & ongoing help  
**Source:** `flow-registry.md` lines 2701-2917  
**Purpose:** Onboarding, Help Content, SP Calculator  

**Customer-Facing Screens Needed:**
1. **EducationCarouselScreen** (during onboarding)
   - Illustrated slides explaining: How SP works, Safe trading tips, Fee structure, Community guidelines
   - Progress dots, skip/next navigation
   - "Got It" CTA to complete education
   
2. **HelpCenterScreen** (accessible from Settings)
   - Topic categories: SP Mechanics, Buying, Selling, Safety, Account
   - Search bar for help articles
   - Featured articles carousel
   - Link to Contact Support
   
3. **SPCalculatorScreen** (accessible from Wallet or Item Detail)
   - Input: Item price slider
   - Output: SP earned (by tier), fees breakdown, net payout
   - Tier comparison table
   - "What is SP?" educational tooltip
   
4. **HelpArticleDetailScreen**
   - Article title, body (Markdown support)
   - Related articles section
   - "Was this helpful?" feedback buttons
   - Share article option

**Database:** `education_sections`, `education_examples`, `education_analytics`  
**Implementation Status:** Backend complete (EDU-001 through EDU-010), UI missing  
**Design Impact:** Medium — 4 new screens + SP calculator component

---

### **FLOW-21: ID Verification (Manual Badge Upload)**
**Priority:** P0 (Critical) — Trust & Safety requirement  
**Source:** `flow-registry.md` lines 3185-3294  
**Purpose:** User submits government ID for Verified badge  
**Status:** ⚠️ **PARTIALLY COVERED**

**Already Designed in FLOW-18 (CPSC Recalls/Admin):**
- Admin queue, admin review page (admin portal only)

**Missing Customer-Facing Screens:**
1. **IDVerificationUploadScreen** (mobile)
   - Disclaimer text (configurable from DB)
   - Photo capture: Camera or gallery picker
   - "Why do we need this?" info modal
   - Privacy notice: "Deleted immediately after review"
   - "Submit for Verification" CTA
   
2. **IDVerificationStatusScreen** (mobile - status tracking)
   - Status card: Pending / Approved / Rejected
   - If pending: "Review in progress, we'll notify you within 24 hours"
   - If approved: "Verified" badge with celebration animation
   - If rejected: Rejection reason + admin notes + "Resubmit" CTA
   - View submission history

**Integration:** Profile screen shows "Upgrade to Verified" CTA → opens IDVerificationUploadScreen  
**Database:** `id_badge_verification_requests`, `id_badge_verification_messages`  
**Implementation Status:** Backend complete (BADGE-009, BADGE-013), mobile UI screens missing  
**Design Impact:** Medium — 2 new screens + profile integration

---

### **FLOW-24: MFA / Multi-Factor Enrollment**
**Priority:** P1 (High) — Account security enhancement  
**Source:** `flow-registry.md` lines 3307-3312  
**Purpose:** TOTP/SMS/WebAuthn enrollment for high-value actions  

**Customer-Facing Screens Needed:**
1. **MFAEnrollmentScreen** (Settings → Security)
   - Current MFA status: Enabled/Disabled
   - Available methods: TOTP (Authenticator App), SMS, WebAuthn (Biometric)
   - "Add Authentication Method" CTA per method
   - List of enrolled factors with remove option
   
2. **TOTPSetupScreen**
   - QR code display (scan with authenticator app)
   - Manual entry code (fallback)
   - "Verify Setup" with 6-digit code input
   - Backup codes generation (10 single-use codes)
   - "Download Backup Codes" CTA
   
3. **SMSSetupScreen**
   - Phone number input (verify if not already verified)
   - "Send Verification Code" CTA
   - 6-digit OTP input
   - "Enable SMS MFA" confirmation
   
4. **MFAVerificationModal** (triggered on sensitive actions)
   - Context: "Confirm your identity to [action]"
   - Code input (6 digits)
   - "Use backup code" link
   - "Cancel" / "Verify" CTAs

**Database:** Supabase Auth built-in `auth.mfa_factors` table  
**Implementation Status:** Backend complete (FLOW-24), UI missing  
**Design Impact:** Medium — 4 new screens + modal component

---

### **FLOW-27: Refunds & Cancellations**
**Priority:** P1 (High) — Critical customer service flow  
**Source:** `flow-registry.md` lines 3325-3330  
**Purpose:** Buyer/seller cancellation and refund requests  

**Customer-Facing Screens Needed:**
1. **RequestRefundScreen** (Trade Detail → "Request Refund")
   - Refund reason selector: Item not as described, Damaged, Never received, Changed mind
   - Photo upload (evidence)
   - Description textarea
   - Platform fee notice: "Non-refundable if seller not at fault"
   - SP reversal notice: "SP will be returned to wallet if approved"
   - "Submit Request" CTA
   
2. **RefundStatusScreen** (Trade Detail → "Refund Status")
   - Status card: Requested / Under Review / Approved / Denied / Completed
   - Timeline: Request submitted → Admin review → Decision → Refund processed
   - If approved: "Refund of $X.XX will be issued to [payment method]"
   - If denied: Admin reason + appeal option
   - Expected completion date
   
3. **CancelTradeModal** (before trade starts)
   - Confirmation: "Are you sure you want to cancel?"
   - Consequences: Full refund (buyer), No SP earned (seller)
   - "Cancel Trade" / "Keep Trade" CTAs
   
4. **RefundHistoryScreen** (Profile → Settings → Refund History)
   - List of all refund requests (buyer + seller)
   - Filters: Status, Date range
   - Per-item card: Item thumbnail, refund amount, status, date

**Database:** `trade_refunds` (TBD), `refund_requests` (TBD)  
**Implementation Status:** Backend smoke script exists, UI missing  
**Design Impact:** High — 4 new screens + modal + trade detail integration

---

### **FLOW-31: Terms of Service (TOS) System**
**Priority:** P0 (Critical) — Legal compliance requirement  
**Source:** `flow-registry.md` lines 3577-3736  
**Purpose:** Display TOS, track user acceptance, require acceptance on updates  

**Customer-Facing Screens Needed:**
1. **TOSScreen** (Settings → Terms of Service)
   - TOS content (Markdown/HTML, scrollable)
   - Version number + last updated date
   - "Effective Date: [date]"
   - If unaccepted: "Accept Terms" CTA (fixed to bottom, sticky)
   - If accepted: "You accepted v1.2.0 on May 1, 2026" (gray text)
   
2. **TOSAcceptanceModal** (blocking modal on version change)
   - "We've Updated Our Terms" header
   - Summary of key changes (bullet points)
   - "Read Full Terms" link (opens TOSScreen)
   - Checkbox: "I have read and agree to the Terms of Service"
   - "Continue" CTA (disabled until checked)
   - "Decline" → Logs out user
   
3. **TOSHistoryScreen** (optional — Settings → Terms → View History)
   - List of all TOS versions
   - Per-version: Version number, effective date, "View" CTA
   - User acceptance status per version

**Database:** `terms_of_service` (versions), `user_tos_acceptance` (acceptance log)  
**Implementation Status:** Backend complete (SAFETY-010), UI missing  
**Design Impact:** Medium — 2-3 screens + blocking modal

---

### **FLOW-32: Privacy Policy System**
**Priority:** P0 (Critical) — Legal compliance requirement  
**Source:** `flow-registry.md` lines 3737-3891  
**Purpose:** Display Privacy Policy, track acknowledgment, inform users of changes  

**Customer-Facing Screens Needed:**
1. **PrivacyPolicyScreen** (Settings → Privacy Policy)
   - Privacy policy content (Markdown/HTML, scrollable)
   - Version number + last updated date
   - "Effective Date: [date]"
   - Sections: Data we collect, How we use data, Data sharing, Your rights, Contact us
   - "Acknowledge Changes" CTA (if new version unacknowledged)
   
2. **PrivacyPolicyUpdateModal** (non-blocking notification)
   - "We've Updated Our Privacy Policy" header
   - Summary of key changes
   - "Review Policy" CTA (opens PrivacyPolicyScreen)
   - "Dismiss" CTA (can dismiss, not blocking)
   - Badge on Settings tab until acknowledged
   
3. **DataRightsScreen** (Settings → Privacy → Your Data Rights)
   - "Download Your Data" CTA (triggers export job)
   - "Delete Your Account" CTA (opens confirmation flow)
   - "Manage Cookies" (future web app)
   - Export status: Requested / Processing / Ready for Download

**Database:** `privacy_policy` (versions), `user_privacy_acknowledgment` (acknowledgment log)  
**Implementation Status:** Backend complete (SAFETY-011), UI missing  
**Design Impact:** Medium — 3 screens + notification modal

---

### **FLOW-33: Liability Disclaimer System**
**Priority:** P0 (Critical) — Legal compliance requirement  
**Source:** `flow-registry.md` lines 3892-4111  
**Purpose:** Display liability disclaimers, require acceptance before risky actions  

**Customer-Facing Screens Needed:**
1. **DisclaimerScreen** (Settings → Liability Disclaimer)
   - Disclaimer content (Markdown/HTML)
   - Version number + last updated date
   - Key points: Platform not liable for item quality, safety, transaction disputes
   - "I Understand" CTA (first-time acceptance)
   
2. **ListingDisclaimerModal** (triggered before first listing)
   - Context: "Before You List Your First Item"
   - Short disclaimer: "You are responsible for item safety, accuracy, and meetup safety"
   - Checkbox: "I understand and accept the liability disclaimer"
   - "Read Full Disclaimer" link
   - "Accept & Continue" CTA
   
3. **TransactionDisclaimerModal** (triggered before first purchase)
   - Context: "Before Your First Purchase"
   - Short disclaimer: "Inspect items before pickup. Report issues within 48 hours."
   - Checkbox: "I understand the buyer responsibilities"
   - "Read Full Disclaimer" link
   - "Accept & Continue" CTA

**Database:** `liability_disclaimer` (versions), `user_disclaimer_acceptance` (acceptance log)  
**Implementation Status:** Backend complete (SAFETY-012), UI missing  
**Design Impact:** Medium — 1 screen + 2 modal components

---

## ✅ BACKEND/ADMIN-ONLY FLOWS (CORRECTLY EXCLUDED)

These flows are backend-only or admin portal-only, and do NOT require customer-facing mobile UI:

| Flow ID | Flow Name | Why Excluded |
|---------|-----------|--------------|
| FLOW-20 | Audit/Logging | Backend observability only |
| FLOW-22 | Seller Payouts & Withdrawals | Backend payment processing (seller sees balance in Profile) |
| FLOW-23 | Payout Method Verification | Backend verification (seller adds method in Settings) |
| FLOW-25 | Manual Payout Admin | Admin portal only |
| FLOW-26 | Webhook Processing | Backend Stripe/PayPal webhooks |
| FLOW-28 | Cron & Background Jobs | Backend scheduled tasks |
| FLOW-29 | ID Badge Notifications | Backend (integrated into FLOW-21) |
| FLOW-30 | SP Wallet Admin | Admin portal only |

---

## 📊 COVERAGE SUMMARY

| Category | Count | Status |
|----------|-------|--------|
| **Total Flows in flow-registry.md** | 33 | — |
| **Customer-Facing Flows** | 25 | — |
| **Covered in figma-agent-prompts.md** | 18 | ✅ Complete |
| **Missing Customer-Facing Flows** | 7 | ⚠️ Action Required |
| **Backend/Admin-Only Flows** | 8 | ✅ Correctly Excluded |

---

## 🎯 RECOMMENDED ACTIONS

### **Option 1: Include All Missing Flows (Comprehensive Redesign)**
**Pros:** 100% coverage, complete UX overhaul  
**Cons:** Extended timeline (+2-3 weeks), increased budget (+$150-200 for illustrations/assets)  
**Total Flows:** 25 (18 existing + 7 new)  
**New Screens:** ~20-25 additional screens  

**Additional Flows to Design:**
1. ✅ **FLOW-19: Trading Education** (4 screens) — P1 High
2. ✅ **FLOW-21: ID Verification (Mobile)** (2 screens) — P0 Critical  
3. ✅ **FLOW-24: MFA Enrollment** (4 screens) — P1 High
4. ✅ **FLOW-27: Refunds & Cancellations** (4 screens) — P1 High
5. ✅ **FLOW-31: Terms of Service** (2 screens) — P0 Critical
6. ✅ **FLOW-32: Privacy Policy** (3 screens) — P0 Critical
7. ✅ **FLOW-33: Liability Disclaimer** (3 screens) — P0 Critical

---

### **Option 2: Include Only Critical Missing Flows (MVP+)**
**Pros:** Faster delivery, lower cost, focuses on legal compliance  
**Cons:** Leaves nice-to-have features (Education, MFA, Refunds) for Phase 4  
**Total Flows:** 22 (18 existing + 4 new)  
**New Screens:** ~10-12 additional screens  

**Critical Flows Only:**
1. ✅ **FLOW-21: ID Verification (Mobile)** (2 screens) — P0 Critical (trust & safety)
2. ✅ **FLOW-31: Terms of Service** (2 screens) — P0 Critical (legal compliance)
3. ✅ **FLOW-32: Privacy Policy** (3 screens) — P0 Critical (legal compliance)
4. ✅ **FLOW-33: Liability Disclaimer** (3 screens) — P0 Critical (legal compliance)

**Deferred to Phase 4:**
- FLOW-19: Trading Education (P1 — nice-to-have)
- FLOW-24: MFA Enrollment (P1 — security enhancement, not blocking)
- FLOW-27: Refunds & Cancellations (P1 — customer service enhancement)

---

### **Option 3: Keep Current Scope (18 Flows)**
**Pros:** Fastest delivery, lowest cost, completed ahead of schedule  
**Cons:** Leaves 7 customer-facing flows undesigned (will need separate design effort later)  
**Total Flows:** 18 (current)  
**Status:** Document 4 & 5 already complete  

**Next Steps:** Proceed to Phase 2 (Figma design) with current 18 flows, schedule Phase 4 for remaining 7 flows after MVP launch

---

## 💡 RECOMMENDATION

**Go with Option 2: Include Only Critical Missing Flows (MVP+)**

**Rationale:**
1. **Legal Compliance:** FLOW-31, 32, 33 are REQUIRED for App Store approval and GDPR/CCPA compliance
2. **Trust & Safety:** FLOW-21 (ID Verification) is critical for marketplace trust and fraud prevention
3. **Timeline:** +1 week for Figma design, +1 week for implementation = 2 weeks total delay (acceptable)
4. **Budget:** Minimal increase (~$50 for legal document illustrations)
5. **Phase 4 Flexibility:** Nice-to-have flows (Education, MFA, Refunds) can be designed post-launch with user feedback

**Updated Timeline:**
- Phase 1: Complete ✅ (5 documents)
- **Phase 1.5: Add 4 Critical Flows** (1 week) — Document 4 update
- Phase 2: Figma Design (6 weeks) — was 5 weeks
- Phase 3: Implementation (6 weeks) — was 5 weeks
- **Total: 13 weeks** (vs original 10 weeks)

---

## 📝 NEXT STEPS

**User Decision Required:**
1. Choose Option 1, 2, or 3 above
2. If Option 1 or 2: Approve updated timeline and budget
3. If Option 2: I'll create FLOW-19, 21, 24, 27, 31, 32, 33 prompts for Document 4
4. If Option 3: Proceed to Phase 2 with current 18 flows

**Let me know which option you prefer, and I'll proceed accordingly!** 🚀
