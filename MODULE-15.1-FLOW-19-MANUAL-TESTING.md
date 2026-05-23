# MODULE-15.1 FLOW-19: Manual Testing Guide
## Help & Support Screens

**Test Environment:** iOS & Android Simulators  
**Module:** MODULE-15.1 UI Redesign  
**Flow:** FLOW-19 (Help & Support)  
**Screens:** HelpScreen, FAQDetailScreen, ContactSupportScreen

---

## Pre-Test Setup

### Requirements
- ✅ App installed on iOS simulator
- ✅ App installed on Android simulator
- ✅ User logged in (or navigation path to Help screen is accessible)
- ✅ Supabase staging environment running (if support form submits to backend)

### Navigation to Help & Support
**Path:** Settings → Help & Support  
(Adjust based on actual navigation in your app)

---

## Test Suite 1: Help Screen (FAQ List)

### TC-01: Initial Screen Load
**Objective:** Verify Help screen renders all UI elements correctly

**Steps:**
1. Navigate to Help & Support from Settings
2. Observe screen layout

**Expected Results:**
- ✅ Header displays "Help & Support" (20px, semibold)
- ✅ Back button visible (ArrowLeft icon, 24px)
- ✅ Search bar visible:
  - Background: `#F0F0F0` (filled style)
  - Border radius: 12px
  - Height: 48px
  - MagnifyingGlass icon (20px, `#999999`) on left
  - Placeholder: "Search help articles…"
- ✅ Category chips visible in horizontal scroll:
  - All, Getting Started, Swap Points, Trading, Account, Safety
  - "All" chip is active (green background `#5DBB8E`, white text)
  - Other chips are inactive (gray background `#F0F0F0`, dark text `#6B6B6B`)
- ✅ FAQ list displays multiple questions
- ✅ Each FAQ row has:
  - Question icon (16px, `#5DBB8E`) on left
  - Question text (15px, `#1A1A1A`)
  - CaretRight icon (16px, `#999999`) on right
- ✅ Sticky footer button "Contact Us":
  - Green pill (backgroundColor `#5DBB8E`, borderRadius 26, height 52)
  - ChatCircle icon (18px, white) on left
  - White text (16px, semibold)

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-02: Search Functionality - Valid Query
**Objective:** Verify search filters FAQs correctly

**Steps:**
1. On Help screen, tap search bar
2. Type "Swap Points"
3. Observe filtered results

**Expected Results:**
- ✅ FAQ list updates to show only FAQs matching "Swap Points":
  - "How do I earn Swap Points?"
  - "Can I use Swap Points for any purchase?"
- ✅ Unrelated FAQs are hidden (e.g., "How do I create my first listing?")
- ✅ Search is case-insensitive (typing "swap points" also works)

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-03: Search Functionality - Empty State
**Objective:** Verify empty state displays when no results found

**Steps:**
1. On Help screen, tap search bar
2. Type "nonexistent query xyz"
3. Observe empty state

**Expected Results:**
- ✅ FAQ list is empty
- ✅ Empty state is visible:
  - Question icon (64px, `#E0E0E0`)
  - Title: "No results found" (18px, semibold)
  - Subtitle: "Try a different search or category" (14px, `#6B6B6B`)
- ✅ Contact Us footer button remains visible

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-04: Category Filtering
**Objective:** Verify category chips filter FAQs correctly

**Steps:**
1. On Help screen, tap "Swap Points" category chip
2. Observe filtered results
3. Tap "All" category chip
4. Observe results

**Expected Results:**
- ✅ After tapping "Swap Points":
  - Chip becomes active (green background, white text)
  - FAQ list shows only Swap Points FAQs
  - Other category FAQs are hidden
- ✅ After tapping "All":
  - "All" chip becomes active
  - FAQ list shows all FAQs from all categories

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-05: Combined Search + Category Filter
**Objective:** Verify search and category filters work together

**Steps:**
1. On Help screen, tap "Trading" category chip
2. In search bar, type "complete"
3. Observe filtered results

**Expected Results:**
- ✅ FAQ list shows only Trading FAQs that match "complete":
  - "How do I complete a trade?"
- ✅ Other results are hidden (even if they match search or category individually)

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-06: Navigate to FAQ Detail
**Objective:** Verify tapping FAQ navigates to detail screen

**Steps:**
1. On Help screen, tap any FAQ row (e.g., "How do I create my first listing?")
2. Observe navigation

**Expected Results:**
- ✅ Navigates to FAQ Detail screen
- ✅ FAQ Detail screen displays (see Test Suite 2)

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-07: Navigate to Contact Support from Footer
**Objective:** Verify Contact Us button navigates to Contact Support

**Steps:**
1. On Help screen, scroll to bottom (if needed)
2. Tap "Contact Us" button
3. Observe navigation

**Expected Results:**
- ✅ Navigates to Contact Support screen
- ✅ Contact Support screen displays (see Test Suite 3)

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-08: Back Button Navigation
**Objective:** Verify back button navigates to previous screen

**Steps:**
1. On Help screen, tap back button (ArrowLeft icon)
2. Observe navigation

**Expected Results:**
- ✅ Navigates back to previous screen (Settings or wherever Help was opened from)

**Pass/Fail:** ___________  
**Notes:** ___________

---

## Test Suite 2: FAQ Detail Screen

### TC-09: FAQ Detail Display
**Objective:** Verify FAQ detail screen displays all content correctly

**Steps:**
1. From Help screen, tap "How do I create my first listing?"
2. Observe FAQ detail layout

**Expected Results:**
- ✅ Header displays "FAQ" (20px, semibold)
- ✅ Back button visible (ArrowLeft icon, 24px)
- ✅ Category badge visible:
  - Background: `#E8F5F0`
  - Text: "Getting Started" (12px, `#5DBB8E`, uppercase)
  - Border radius: 12px
- ✅ Question displayed with Question icon (24px, `#5DBB8E`) on left:
  - Question text: "How do I create my first listing?" (20px, semibold)
- ✅ Answer text displayed:
  - Text: "Tap the \"Sell\" button..." (16px, `#6B6B6B`, lineHeight 24)
- ✅ Horizontal divider line (1px, `#F0F0F0`)
- ✅ "Was this helpful?" section:
  - Title: "Was this helpful?" (16px, semibold, centered)
  - Two buttons: "👍 Yes" and "👎 No"
  - Buttons have gray background `#F0F0F0`, borderRadius 20
- ✅ "Still need help?" section:
  - Title: "Still need help?" (16px, semibold)
  - Green "Contact Support" button (backgroundColor `#5DBB8E`, borderRadius 24)

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-10: Helpful Feedback - Yes
**Objective:** Verify "Yes" button navigates back to Help

**Steps:**
1. On FAQ Detail screen, tap "👍 Yes" button
2. Observe navigation

**Expected Results:**
- ✅ Navigates back to Help screen
- ✅ Help screen displays FAQ list

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-11: Helpful Feedback - No
**Objective:** Verify "No" button navigates to Contact Support

**Steps:**
1. On FAQ Detail screen, tap "👎 No" button
2. Observe navigation

**Expected Results:**
- ✅ Navigates to Contact Support screen
- ✅ Contact Support screen displays (see Test Suite 3)

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-12: Contact Support from FAQ Detail
**Objective:** Verify Contact Support button navigates correctly

**Steps:**
1. On FAQ Detail screen, scroll to bottom
2. Tap "Contact Support" button
3. Observe navigation

**Expected Results:**
- ✅ Navigates to Contact Support screen
- ✅ Contact Support screen displays

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-13: Back Button from FAQ Detail
**Objective:** Verify back button navigates to Help screen

**Steps:**
1. On FAQ Detail screen, tap back button
2. Observe navigation

**Expected Results:**
- ✅ Navigates back to Help screen
- ✅ Previously selected search/category filters are preserved (or reset to "All")

**Pass/Fail:** ___________  
**Notes:** ___________

---

## Test Suite 3: Contact Support Screen

### TC-14: Contact Form Display
**Objective:** Verify Contact Support screen displays all form elements

**Steps:**
1. Navigate to Contact Support screen (from Help or FAQ Detail)
2. Observe form layout

**Expected Results:**
- ✅ Header displays "Contact Support" (20px, semibold)
- ✅ Back button visible (ArrowLeft icon, 24px)
- ✅ Intro text visible:
  - "Have a question or issue? Send us a message and we'll get back to you within 24 hours."
  - 15px, `#6B6B6B`, lineHeight 22
- ✅ Subject input field:
  - Label: "SUBJECT" (12px, `#6B6B6B`, uppercase)
  - Filled style (backgroundColor `#F0F0F0`, borderRadius 12, height 52)
  - EnvelopeSimple icon (20px, `#6B6B6B`) on left
  - Placeholder: "Enter subject"
- ✅ Message textarea:
  - Label: "MESSAGE" (12px, `#6B6B6B`, uppercase)
  - Filled style (backgroundColor `#F0F0F0`, borderRadius 12, minHeight 120px)
  - Placeholder: "Describe your issue or question…"
  - textAlignVertical: 'top' (text starts at top of textarea)
- ✅ Character count: "0 / 1000" (13px, `#999999`, right-aligned)
- ✅ Send Message button:
  - Green pill (backgroundColor `#5DBB8E`, borderRadius 26, height 52)
  - Text: "Send Message" (16px, semibold, white)
- ✅ Email fallback text:
  - "Or email us at support@passitup.com"
  - "support@passitup.com" is green (`#5DBB8E`)
  - Rest of text is gray (`#6B6B6B`)
  - Centered, 13px

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-15: Form Validation - Empty Subject
**Objective:** Verify form shows alert when subject is empty

**Steps:**
1. On Contact Support screen, leave subject field empty
2. Tap "Send Message" button
3. Observe alert

**Expected Results:**
- ✅ Alert displays with title "Missing Subject"
- ✅ Alert message: "Please enter a subject for your message."
- ✅ Alert has "OK" button
- ✅ Form is not submitted
- ✅ User remains on Contact Support screen

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-16: Form Validation - Empty Message
**Objective:** Verify form shows alert when message is empty

**Steps:**
1. On Contact Support screen, type "Test Subject" in subject field
2. Leave message field empty
3. Tap "Send Message" button
4. Observe alert

**Expected Results:**
- ✅ Alert displays with title "Missing Message"
- ✅ Alert message: "Please enter your message."
- ✅ Alert has "OK" button
- ✅ Form is not submitted
- ✅ User remains on Contact Support screen

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-17: Character Count Update
**Objective:** Verify character count updates as user types

**Steps:**
1. On Contact Support screen, tap message textarea
2. Type "Hello world" (11 characters)
3. Observe character count

**Expected Results:**
- ✅ Character count updates to "11 / 1000"
- ✅ Character count is right-aligned below textarea
- ✅ Count is accurate (matches typed text length)

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-18: Form Submission - Success
**Objective:** Verify form submits successfully with valid inputs

**Steps:**
1. On Contact Support screen, type "Test Support Request" in subject
2. Type "This is a test message to verify the contact support form works correctly." in message
3. Tap "Send Message" button
4. Observe submission flow

**Expected Results:**
- ✅ Button text changes to "Sending…" during submission
- ✅ Button is disabled during submission (cannot double-tap)
- ✅ Success alert displays:
  - Title: "Message Sent"
  - Message: "Thank you for contacting us. We'll respond within 24 hours."
  - OK button
- ✅ After tapping OK, navigates back to previous screen (Help or FAQ Detail)
- ✅ Form is reset (if user navigates back to Contact Support, fields are empty)

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-19: Input Constraints
**Objective:** Verify input fields enforce max length

**Steps:**
1. On Contact Support screen, type a very long subject (150+ characters)
2. Observe character limit
3. Type a very long message (1500+ characters)
4. Observe character limit

**Expected Results:**
- ✅ Subject field prevents typing beyond 100 characters
- ✅ Message field prevents typing beyond 1000 characters
- ✅ Character count shows "1000 / 1000" when limit is reached

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-20: Back Button from Contact Support
**Objective:** Verify back button navigates to previous screen

**Steps:**
1. On Contact Support screen, tap back button
2. Observe navigation

**Expected Results:**
- ✅ Navigates back to Help screen (or FAQ Detail if came from there)
- ✅ Typed form data is lost (not persisted)

**Pass/Fail:** ___________  
**Notes:** ___________

---

## Test Suite 4: Design System Compliance

### TC-21: Filled Input Style (Search Bar)
**Objective:** Verify search bar uses MODULE-15.1 filled input style

**Steps:**
1. On Help screen, observe search bar
2. Compare with design specs

**Expected Results:**
- ✅ Background color: `#F0F0F0` (light gray fill, no border)
- ✅ Border radius: 12px
- ✅ Height: 48px
- ✅ Padding: 12px horizontal
- ✅ Gap between icon and input: 8px
- ✅ MagnifyingGlass icon: 20px, `#999999`
- ✅ Input text: 15px, `#1A1A1A`
- ✅ Placeholder text: 15px, `#999999`

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-22: Category Chip Active State
**Objective:** Verify active category chip uses green style

**Steps:**
1. On Help screen, observe "All" chip (default active)
2. Compare with design specs

**Expected Results:**
- ✅ Background color: `#5DBB8E` (primary green)
- ✅ Text color: `#FFFFFF` (white)
- ✅ Font weight: 500 (medium)
- ✅ Border radius: 20px (pill shape)
- ✅ Padding: 16px horizontal, 8px vertical

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-23: Category Chip Inactive State
**Objective:** Verify inactive category chip uses gray style

**Steps:**
1. On Help screen, observe "Trading" chip (inactive)
2. Compare with design specs

**Expected Results:**
- ✅ Background color: `#F0F0F0` (light gray)
- ✅ Text color: `#6B6B6B` (dark gray)
- ✅ Font weight: normal
- ✅ Border radius: 20px
- ✅ Padding: 16px horizontal, 8px vertical

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-24: FAQ Row Icons
**Objective:** Verify FAQ rows use correct Phosphor icons

**Steps:**
1. On Help screen, observe FAQ rows
2. Compare icons with design specs

**Expected Results:**
- ✅ Left icon: Question (Phosphor), 16px, `#5DBB8E`
- ✅ Right icon: CaretRight (Phosphor), 16px, `#999999`
- ✅ Icon vertical alignment: centered with text
- ✅ Gap between left icon and text: 10px

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-25: Contact Us Footer Button
**Objective:** Verify footer button uses green pill style

**Steps:**
1. On Help screen, observe Contact Us button
2. Compare with design specs

**Expected Results:**
- ✅ Background color: `#5DBB8E` (primary green)
- ✅ Border radius: 26px (pill shape)
- ✅ Height: 52px
- ✅ Icon: ChatCircle (Phosphor), 18px, white, filled variant
- ✅ Text: "Contact Us", 16px, semibold, white
- ✅ Flexbox: row, centered, gap 8px

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-26: Filled Input Style (Contact Form)
**Objective:** Verify Contact Support form uses filled input style

**Steps:**
1. On Contact Support screen, observe subject input and message textarea
2. Compare with design specs

**Expected Results:**
- ✅ Subject input:
  - Background color: `#F0F0F0`
  - Border radius: 12px
  - Height: 52px
  - EnvelopeSimple icon: 20px, `#6B6B6B`
  - Input text: 16px, `#1A1A1A`
  - Placeholder text: 16px, `#999999`
- ✅ Message textarea:
  - Background color: `#F0F0F0`
  - Border radius: 12px
  - Min height: 120px
  - textAlignVertical: 'top'
  - Input text: 16px, `#1A1A1A`
  - Placeholder text: 16px, `#999999`

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-27: Email Highlight Color
**Objective:** Verify email address is highlighted in green

**Steps:**
1. On Contact Support screen, observe email fallback text
2. Compare with design specs

**Expected Results:**
- ✅ Text: "Or email us at support@passitup.com"
- ✅ "Or email us at" text color: `#6B6B6B`
- ✅ "support@passitup.com" text color: `#5DBB8E` (green)
- ✅ Font size: 13px
- ✅ Text alignment: centered

**Pass/Fail:** ___________  
**Notes:** ___________

---

## Test Suite 5: Accessibility

### TC-28: Screen Reader Support
**Objective:** Verify accessibility labels are present

**Steps:**
1. Enable VoiceOver (iOS) or TalkBack (Android)
2. Navigate through Help screen
3. Verify screen reader announces elements correctly

**Expected Results:**
- ✅ Back button: "Go back"
- ✅ Search input: "Search help articles"
- ✅ Category chips: "Filter by All", "Filter by Swap Points", etc.
- ✅ FAQ rows: Full question text is announced
- ✅ Contact Us button: "Contact us"

**Pass/Fail:** ___________  
**Notes:** ___________

---

### TC-29: Accessibility State - Category Chips
**Objective:** Verify selected category chip is announced as selected

**Steps:**
1. Enable VoiceOver/TalkBack
2. Focus on "All" category chip
3. Observe accessibility state

**Expected Results:**
- ✅ Screen reader announces "Filter by All, selected" (or equivalent)
- ✅ When tapping another chip, selected state moves to new chip

**Pass/Fail:** ___________  
**Notes:** ___________

---

## Test Suite 6: End-to-End User Flows

### TC-30: Full Help Journey
**Objective:** Verify complete user flow from Help to Contact Support

**Steps:**
1. Navigate to Help screen
2. Search for "Swap Points"
3. Tap "How do I earn Swap Points?" FAQ
4. On FAQ Detail, tap "👎 No" (not helpful)
5. On Contact Support, fill subject and message
6. Submit form
7. Observe success and navigation

**Expected Results:**
- ✅ All navigation transitions are smooth
- ✅ Search filters work correctly
- ✅ FAQ detail displays correctly
- ✅ Contact form validates and submits
- ✅ Success alert is shown
- ✅ User is navigated back after submission

**Pass/Fail:** ___________  
**Notes:** ___________

---

## Test Summary

**Date:** ___________  
**Tester:** ___________  
**Platform:** iOS ☐  Android ☐  
**iOS Version:** ___________  
**Android Version:** ___________  

**Total Test Cases:** 30  
**Passed:** ___________  
**Failed:** ___________  
**Blocked:** ___________  

**Overall Status:** ☐ PASS  ☐ FAIL  ☐ BLOCKED

---

## Bugs & Issues Found

| Bug ID | Test Case | Description | Severity | Status |
|--------|-----------|-------------|----------|--------|
|        |           |             |          |        |
|        |           |             |          |        |
|        |           |             |          |        |

---

## Notes & Observations

_Use this space to document any additional observations, edge cases, or recommendations:_

---

## Sign-Off

**Tester Signature:** ___________  
**Date:** ___________
