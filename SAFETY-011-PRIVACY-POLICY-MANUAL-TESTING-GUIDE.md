# SAFETY-011: Privacy Policy System - Manual Testing Guide

**Module:** MODULE-13-SAFETY-COMPLIANCE  
**Task:** SAFETY-011 - Implement Admin-Managed Privacy Policy System  
**Status:** Ready for Manual Testing

---

## 📋 Prerequisites

Before testing, ensure:
1. ✅ Supabase production database is running
2. ✅ At least one Privacy Policy is published via admin portal
3. ✅ iOS / Android simulator is running
4. ✅ Test user account exists

---

## 🔍 Database Verification (Run in Supabase SQL Editor)

```sql
-- Verify platform_policies table exists and has privacy_policy entries
SELECT COUNT(*) FROM platform_policies WHERE policy_type = 'privacy_policy';
-- Expected: At least 1

-- Check current published Privacy Policy
SELECT id, version, title, status FROM platform_policies 
WHERE policy_type = 'privacy_policy' AND status = 'published' 
ORDER BY effective_date DESC LIMIT 1;
-- Expected: 1 row with status 'published'

-- Verify policy_acceptances table exists
SELECT COUNT(*) FROM policy_acceptances WHERE policy_type = 'privacy_policy';
-- Expected: 0 or more (depending on test history)

-- Verify RPC functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_current_policy', 'has_accepted_current_policy', 'record_policy_acceptance');
-- Expected: 3 rows
```

---

## 🧪 Test Cases

### Test Case 1: Admin Creates Privacy Policy
**Goal:** Verify admin can create and publish Privacy Policy

**Steps:**
1. Open admin portal: `http://localhost:3001`
2. Login as admin user
3. Navigate to: Settings → Policies
4. Click "Privacy Policy" tab
5. Click "Create New Version"
6. Fill in form:
   - **Type**: Privacy Policy (auto-selected)
   - **Version**: `1.0`
   - **Title**: `Kids P2P Marketplace Privacy Policy`
   - **Content** (Markdown):
     ```markdown
     # Privacy Policy

     ## 1. Information We Collect
     We collect information you provide directly...

     ## 2. How We Use Your Information
     Your information is used to operate the platform...

     ## 3. Data Security
     We implement industry-standard security measures...
     ```
   - **Effective Date**: Select today's date
7. Set **Status**: `Published`
8. Click "Save"

**Expected Results:**
- ✅ Policy created successfully
- ✅ Status shows "published"
- ✅ Version `1.0` displayed
- ✅ Markdown preview renders correctly

---

### Test Case 2: View Privacy Policy from Settings
**Goal:** Verify users can view Privacy Policy from Settings screen  
**Device:** iOS / Android Simulator

**Pre-condition:** User is logged in

**Steps:**
1. Launch app
2. Navigate to Profile tab
3. Tap **Settings**
4. Scroll to find **Privacy Policy** option
   - Testlocation ID: `settings-privacy-policy-button`
5. Tap **Privacy Policy**

**Expected Results:**
- ✅ Privacy Policy screen opens
- ✅ Screen title: "Privacy Policy"
- ✅ Policy version displayed: "Version 1.0"
- ✅ Effective date displayed: "Effective: [date]"
- ✅ Content renders correctly (Markdown formatted)
- ✅ No "Accept" button shown (viewing only)
- ✅ User can scroll through full content
- ✅ Back button returns to Settings

**Test IDs:**
- Screen: `privacy-policy-screen`
- Version: `privacy-policy-version`
- Effective date: `privacy-policy-effective-date`
- Content: `privacy-policy-content`

---

### Test Case 3: View Privacy Policy from Signup
**Goal:** Verify Privacy Policy link works from signup screen  
**Device:** iOS / Android Simulator

**Pre-condition:** User is not logged in

**Steps:**
1. Launch app
2. Navigate to **Sign Up** screen
3. Scroll to bottom
4. Find text: "By signing up, you agree to our Terms of Service and Privacy Policy"
5. Tap **Privacy Policy** link (blue, underlined)
   - Test ID: `privacy-policy-link`

**Expected Results:**
- ✅ Privacy Policy screen opens
- ✅ Screen title: "Privacy Policy"
- ✅ Policy content displayed
- ✅ No "Accept" button shown (implicit acceptance on signup)
- ✅ Back button returns to Signup screen
- ✅ Signup form data preserved (no data loss)

---

### Test Case 4: Privacy Policy Acceptance (Optional Flow)
**Goal:** Verify explicit acceptance flow (if requireAcceptance param passed)  
**Device:** iOS / Android Simulator

**Pre-condition:** 
- User logged in
- `requireAcceptance: true` param passed to screen

**Steps:**
1. Navigate to Privacy Policy screen with `requireAcceptance: true`
2. Scroll through content
3. Tap **Accept Privacy Policy** button at bottom
   - Test ID: `privacy-policy-accept-button`

**Expected Results:**
- ✅ Button visible at bottom of screen
- ✅ Button text: "Accept Privacy Policy"
- ✅ On tap: Loading indicator shows briefly
- ✅ Acceptance recorded in database
- ✅ Screen closes automatically
- ✅ `onAccept` callback triggered (if provided)

**Database Verification:**
```sql
-- Check acceptance recorded
SELECT * FROM policy_acceptances 
WHERE user_id = '[test-user-id]' 
AND policy_type = 'privacy_policy'
ORDER BY accepted_at DESC LIMIT 1;
-- Expected: 1 row with current timestamp
```

---

### Test Case 5: Version Management
**Goal:** Verify version history and current policy always shown  
**Device:** Admin Portal + Mobile App

**Steps:**
1. **Admin Portal:**
   - Create Privacy Policy v1.0 (Status: Published)
   - Create Privacy Policy v2.0 (Status: Draft)
   
2. **Mobile App:**
   - Open Privacy Policy from Settings
   - Verify **Version 1.0** shown (not v2.0)
   
3. **Admin Portal:**
   - Publish Privacy Policy v2.0
   - Previous versions automatically archived
   
4. **Mobile App:**
   - Kill and restart app
   - Open Privacy Policy from Settings
   - Verify **Version 2.0** now shown

**Expected Results:**
- ✅ Only published version visible to users
- ✅ Draft versions not visible
- ✅ Latest published version always shown
- ✅ Version number updates correctly

---

### Test Case 6: Error Handling - No Policy Available
**Goal:** Verify graceful error when no policy exists  
**Device:** iOS / Android Simulator

**Pre-condition:** 
- Archive all Privacy Policies in admin portal (set status = 'archived')

**Steps:**
1. Launch app
2. Navigate to Settings → Privacy Policy

**Expected Results:**
- ✅ Alert shown: "Privacy Policy not available"
- ✅ Screen returns to Settings automatically
- ✅ No crash or blank screen

**Cleanup:**
- Restore at least one Privacy Policy to "published" status

---

### Test Case 7: Markdown Rendering
**Goal:** Verify Markdown content renders correctly  
**Device:** iOS / Android Simulator

**Test Content:**
```markdown
# Privacy Policy

## Bold and Italic
**Bold text** and *italic text*

## Lists
- Item 1
- Item 2
  - Nested item

1. Numbered item 1
2. Numbered item 2

## Links
[Contact Us](https://example.com)

## Code
`inline code`
```

**Expected Results:**
- ✅ Headers styled correctly (# = large, ## = medium)
- ✅ **Bold** and *italic* formatted
- ✅ Bulleted lists indented properly
- ✅ Numbered lists sequential
- ✅ Links tappable and blue
- ✅ Code blocks monospace font

---

### Test Case 8: Navigation Integrity
**Goal:** Verify navigation doesn't break app flow  
**Device:** iOS / Android Simulator

**Steps:**
1. Start at: Home screen
2. Navigate: Profile → Settings → Privacy Policy
3. Tap Back → Returns to Settings
4. Tap Back → Returns to Profile
5. Navigate: Sign Up → Tap Privacy Policy link
6. Tap Back → Returns to Sign Up (data preserved)
7. Complete signup → Privacy Policy acceptance implicit

**Expected Results:**
- ✅ All back navigations work correctly
- ✅ No navigation stack errors
- ✅ Form data preserved on back
- ✅ No "went back too far" crashes

---

### Test Case 9: Cross-Platform Consistency
**Goal:** Verify identical behavior on iOS and Android  
**Devices:** iOS Simulator + Android Emulator

**Steps:**
1. Test Case 2 on iOS
2. Test Case 2 on Android
3. Compare results

**Expected Results:**
- ✅ Same content displayed
- ✅ Same styling and formatting
- ✅ Same navigation behavior
- ✅ Same link behavior
- ✅ No platform-specific bugs

---

### Test Case 10: Performance & Load Time
**Goal:** Verify acceptable performance  
**Device:** iOS / Android Simulator

**Steps:**
1. Clear app cache
2. Navigate to Privacy Policy
3. Measure load time

**Expected Results:**
- ✅ Policy loads in < 2 seconds
- ✅ No noticeable lag when scrolling
- ✅ Markdown renders smoothly
- ✅ No memory leaks on repeated opens

---

## 🚨 Known Issues / Edge Cases

### Issue 1: No Privacy Policy Published
- **Symptom:** Alert: "Privacy Policy not available"
- **Solution:** Ensure at least one Privacy Policy with status='published' exists

### Issue 2: Markdown Not Rendering
- **Symptom:** Raw Markdown text shown instead of formatted
- **Solution:** Verify `react-native-markdown-display` package installed

### Issue 3: Acceptance Not Recorded
- **Symptom:** Database shows no new acceptance entry
- **Solution:** Check RLS policies allow authenticated users to insert into `policy_acceptances`

---

## ✅ Module Verification Checklist

From `MODULE-13-VERIFICATION.md`:

- [ ] **SAFETY-011-1**: Privacy Policy infrastructure reuses platform_policies table
- [ ] **SAFETY-011-2**: Admin can create Privacy Policy versions
- [ ] **SAFETY-011-3**: Admin can publish Privacy Policy
- [ ] **SAFETY-011-4**: Mobile app displays current published Privacy Policy
- [ ] **SAFETY-011-5**: Privacy Policy linked from Settings screen
- [ ] **SAFETY-011-6**: Privacy Policy linked from Signup screen
- [ ] **SAFETY-011-7**: Navigation routes configured correctly
- [ ] **SAFETY-011-8**: Markdown rendering works
- [ ] **SAFETY-011-9**: Version management works (latest published shown)
- [ ] **SAFETY-011-10**: Acceptance tracking works (optional flow)
- [ ] **SAFETY-011-11**: Error states handled gracefully

---

## 🎯 Success Criteria

All test cases must pass with these conditions:
- ✅ No crashes or errors
- ✅ Privacy Policy displays correctly on iOS and Android
- ✅ Settings and Signup links work correctly
- ✅ Admin can manage Privacy Policy versions
- ✅ Latest published version always shown
- ✅ Markdown content renders correctly
- ✅ Navigation works smoothly
- ✅ Performance acceptable (< 2s load time)

---

## 📞 Need Help?

**Common Issues:**
1. **Policy not loading:** Check database has published privacy_policy
2. **Link not working:** Verify PrivacyPolicy route registered in AppNavigator
3. **Markdown not rendering:** Reinstall `react-native-markdown-display`
4. **Database errors:** Check RLS policies for platform_policies table

**Still stuck?** Check:
- Supabase logs for RPC errors
- Metro bundler console for JS errors
- Xcode/Android Studio for native errors

---

**Testing Completed By:** _________________  
**Date:** _________________  
**All Tests Passed:** ☐ Yes ☐ No  
**Notes:** _________________________________________________
