# MSG-003: Image Sharing in Chat — Manual Test Cases

## 📋 Document Overview

**Module:** MODULE-07-MESSAGING  
**Task:** MSG-003 - Image Sharing in Chat  
**Purpose:** Manual test verification for image upload, compression, display, and preview functionality  
**Test Environment:** iOS Simulator / Android Emulator  
**Duration:** ~30-45 minutes for complete test suite

---

## ⚙️ Pre-Test Setup Checklist

Before starting manual tests, ensure the following:

- [ ] React Native app installed and running
- [ ] Latest dependencies installed (`npm install`)
- [ ] Storage migration applied to Supabase (`082_create_chat_images_bucket.sql`)
- [ ] Test user account created and authenticated
- [ ] Access to active trade chat screen available
- [ ] Test images available in device photo library (multiple sizes/formats)
- [ ] Development console/logs accessible for debugging

---

## 🧪 Test Cases

### TC-001: Photo Library Permission Request

**Objective:** Verify proper permission handling for photo library access

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to chat screen from active trade | Chat screen loads successfully |
| 2 | Tap image picker button (📷 icon) | Permission dialog appears (if first time) |
| 3 | Deny photo library permission | Alert shown: "Permission Required" |
| 4 | Tap image picker button again | Permission dialog appears again |
| 5 | Grant photo library permission | Image picker opens successfully |

**Pass Criteria:**
- ✅ Permission dialog appears on first request
- ✅ Clear error message when permission denied
- ✅ Image picker opens after permission granted
- ✅ No app crashes or console errors

**Test Result:** [ ] PASS &nbsp;&nbsp; [ ] FAIL

**Notes:** ___________________________________________

---

### TC-002: Image Selection and Basic Upload

**Objective:** Verify users can select and successfully upload images

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap image picker button | Photo library opens |
| 2 | Select a PNG or JPEG image | Image selected in picker |
| 3 | Confirm selection | Image upload process begins |
| 4 | Wait for upload to complete | Loading indicator disappears |
| 5 | Verify image in chat | Image appears as message bubble |

**Pass Criteria:**
- ✅ Photo library interface opens correctly
- ✅ Image selection works without freezing
- ✅ Loading indicator visible during upload
- ✅ Image message appears in correct position
- ✅ Image displays with proper aspect ratio
- ✅ Timestamp shown below image

**Test Result:** [ ] PASS &nbsp;&nbsp; [ ] FAIL

**Notes:** ___________________________________________

---

### TC-003: Image Compression Verification

**Objective:** Verify images are compressed before upload

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select a large image (>2MB) | Image selected |
| 2 | Monitor console logs | Compression logs appear: "Compressed: XXXxYYY" |
| 3 | Check upload progress | Upload completes in <10 seconds |
| 4 | Verify image in chat | Image loads and displays correctly |
| 5 | Open DevTools/Network tab | Check uploaded file size |

**Expected Compression Results:**
- Image resized to max 1200px width (maintaining aspect ratio)
- Quality reduced to 80%
- File size significantly smaller than original
- Visual quality remains acceptable

**Pass Criteria:**
- ✅ Console shows compression dimensions
- ✅ Upload completes quickly
- ✅ Image quality is acceptable
- ✅ File size reduced from original

**Test Result:** [ ] PASS &nbsp;&nbsp; [ ] FAIL

**Notes:** ___________________________________________

---

### TC-004: Inline Image Display

**Objective:** Verify images display correctly within chat bubbles

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send 3-5 image messages | All images appear in chat |
| 2 | Check image positioning | Own images: right-aligned, blue bubble |
| 3 | Check other user images | Other images: left-aligned, gray bubble |
| 4 | Scroll through chat | All images load and display |
| 5 | Rotate device | Images adapt to new orientation |

**Visual Verification:**
- Own messages right-aligned with blue background
- Other user messages left-aligned with light gray background
- Images maintain 4:3 aspect ratio
- Images have rounded corners (border-radius: 8px)
- No broken image icons or placeholder gaps

**Pass Criteria:**
- ✅ Correct alignment for own vs. other messages
- ✅ Proper aspect ratio maintained
- ✅ Images load completely
- ✅ Responsive to orientation changes
- ✅ Timestamps display below images

**Test Result:** [ ] PASS &nbsp;&nbsp; [ ] FAIL

**Notes:** ___________________________________________

---

### TC-005: Fullscreen Image Preview

**Objective:** Verify fullscreen viewer opens and allows image navigation

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send 3-5 image messages | Multiple images in chat |
| 2 | Tap on first image | Fullscreen viewer opens |
| 3 | Verify fullscreen display | Image displays at full resolution |
| 4 | Swipe left | Next image appears |
| 5 | Swipe right | Previous image appears |
| 6 | Tap outside image | Viewer closes |
| 7 | Return to chat | Scroll position maintained |

**Fullscreen Viewer Requirements:**
- Full-screen image display
- Smooth swipe navigation between images
- Image counter display (e.g., "2 of 5")
- Close button or tap-outside close
- Smooth transitions between images

**Pass Criteria:**
- ✅ Fullscreen opens on single tap
- ✅ Swipe gestures work smoothly
- ✅ Image counter shows current position
- ✅ Easy exit from fullscreen
- ✅ Returns to correct scroll position

**Test Result:** [ ] PASS &nbsp;&nbsp; [ ] FAIL

**Notes:** ___________________________________________

---

### TC-006: Error Handling — Network Issues

**Objective:** Verify graceful error handling for upload failures

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Disable network connection | Network unavailable |
| 2 | Select image for upload | Upload button tapped |
| 3 | Wait for error | Error message appears |
| 4 | Check error message | Clear, user-friendly message shown |
| 5 | Enable network | Network restored |
| 6 | Retry upload | Upload succeeds |

**Error Message Verification:**
- Error message is clear and actionable
- Message explains what went wrong
- User can retry without restarting app
- Console logs show debugging information

**Pass Criteria:**
- ✅ Clear error message displayed
- ✅ App remains stable after error
- ✅ Retry works after issue resolved
- ✅ Loading state clears properly
- ✅ No app crashes

**Test Result:** [ ] PASS &nbsp;&nbsp; [ ] FAIL

**Notes:** ___________________________________________

---

### TC-007: Error Handling — Large File Size

**Objective:** Verify handling of oversized images

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Attempt to upload extremely large image (>10MB) | File selected |
| 2 | Monitor upload process | Error message appears |
| 3 | Check error message | "File too large" message shown |
| 4 | Select smaller image | Upload succeeds |

**Pass Criteria:**
- ✅ Large files are rejected gracefully
- ✅ Clear error message provided
- ✅ No app hang or crash
- ✅ User can select different image

**Test Result:** [ ] PASS &nbsp;&nbsp; [ ] FAIL

**Notes:** ___________________________________________

---

### TC-008: Real-Time Image Messages

**Objective:** Verify images appear in real-time for both users

**Prerequisites:**
- Two test user accounts
- Two devices/simulators OR browser emulation for dual sessions

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open same trade chat on User A | Chat screen loads |
| 2 | Open same trade chat on User B | Chat screen loads |
| 3 | User A sends image message | Image appears on User A's screen |
| 4 | Verify on User B's screen | Image appears immediately (no refresh) |
| 5 | User B sends image | Image appears on User B's screen |
| 6 | Verify on User A's screen | Image appears immediately |
| 7 | Send 5 images rapidly | All appear in correct order |

**Real-Time Requirements:**
- No manual refresh needed
- Messages appear within 1 second
- Correct message order maintained
- No duplicate messages
- Proper sender/receiver alignment on both sides

**Pass Criteria:**
- ✅ Images appear in real-time
- ✅ Correct sender/receiver alignment
- ✅ Chronological order maintained
- ✅ No duplicate messages
- ✅ Works under rapid message load

**Test Result:** [ ] PASS &nbsp;&nbsp; [ ] FAIL

**Notes:** ___________________________________________

---

### TC-009: UI State Management

**Objective:** Verify proper button states during image operations

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap image picker button | Button shows loading spinner |
| 2 | Select image | Image picker closes, upload starts |
| 3 | During upload, tap send button | Send button disabled (grayed out) |
| 4 | During upload, try text input | Text input remains available |
| 5 | Wait for upload completion | All buttons re-enable |
| 6 | Verify text input available | Can type and send text message |

**Button State Requirements:**

| State | Text Button | Image Button | Text Input |
|-------|-------------|--------------|-----------|
| Idle | Enabled | Enabled | Enabled |
| Uploading | Disabled | Disabled | Enabled |
| Error | Enabled | Enabled | Enabled |

**Pass Criteria:**
- ✅ Buttons disable during upload
- ✅ Loading indicators visible
- ✅ Cannot send duplicate uploads
- ✅ Text input functional during image upload
- ✅ States reset after completion

**Test Result:** [ ] PASS &nbsp;&nbsp; [ ] FAIL

**Notes:** ___________________________________________

---

### TC-010: Storage and RLS Verification

**Objective:** Verify images stored correctly with proper access control

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send image message from User A | Image uploads successfully |
| 2 | Open Supabase Storage console | Navigate to chat-images bucket |
| 3 | Check file location | File in correct folder: `{trade_id}/...` |
| 4 | Check filename format | Format: `{sender_id}-{timestamp}-{uuid}.jpg` |
| 5 | Get public image URL | Image accessible via public link |
| 6 | Login as different user | Try accessing image URL |
| 7 | Check RLS enforcement | Non-participant cannot view image |

**Storage Structure Verification:**
```
chat-images/
├── {trade_id_1}/
│   ├── {sender_id_1}-1234567890-abc123.jpg
│   ├── {sender_id_2}-1234567891-def456.jpg
└── {trade_id_2}/
    └── {sender_id_3}-1234567892-ghi789.jpg
```

**Pass Criteria:**
- ✅ Images in correct bucket and folder
- ✅ Filename follows naming convention
- ✅ Public URL accessible
- ✅ RLS prevents unauthorized access
- ✅ File metadata correct (content-type: image/jpeg)

**Test Result:** [ ] PASS &nbsp;&nbsp; [ ] FAIL

**Notes:** ___________________________________________

---

### TC-011: Performance Under Load

**Objective:** Verify app remains responsive with many images

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send 20+ images rapidly | All uploads queued |
| 2 | Monitor memory usage | Memory stays reasonable |
| 3 | Scroll through chat | Smooth scrolling, no lag |
| 4 | Navigate away from chat | Unsubscribe cleanup works |
| 5 | Return to chat | Memory not leaked |
| 6 | Observe UI responsiveness | No freezing or jank |

**Performance Targets:**
- Scroll FPS: 60fps minimum
- Memory: <100MB increase for 20 images
- Upload queue: <5 second interval
- No visible stuttering or lag

**Pass Criteria:**
- ✅ App remains responsive
- ✅ Smooth scrolling with many images
- ✅ No memory leaks
- ✅ Fast navigation between screens
- ✅ Battery drain acceptable

**Test Result:** [ ] PASS &nbsp;&nbsp; [ ] FAIL

**Notes:** ___________________________________________

---

## 📊 Test Summary Report

### Overall Results

| Category | Passed | Failed | Total |
|----------|--------|--------|-------|
| Permission Handling | _ | _ | 2 |
| Upload Functionality | _ | _ | 3 |
| Display & Preview | _ | _ | 2 |
| Real-Time Sync | _ | _ | 1 |
| Error Handling | _ | _ | 2 |
| Storage & Security | _ | _ | 1 |
| **TOTAL** | **_** | **_** | **11** |

### Critical Issues

List any blocking issues that prevent deployment:

- _______________________________________________________________
- _______________________________________________________________

### Minor Issues

List non-blocking issues or improvements:

- _______________________________________________________________
- _______________________________________________________________

### Recommendations

Suggested improvements or follow-up tasks:

- _______________________________________________________________
- _______________________________________________________________

---

## 📝 Test Execution Details

**Tested By:** ________________________  
**Date:** ________________________  
**Build Version:** ________________________  
**Device/Simulator:** ________________________  
**OS Version:** ________________________  

### Environment Notes

- Network: _______________________________________________________________
- Notable Behavior: _______________________________________________________________
- Other Observations: _______________________________________________________________

---

## ✅ Sign-Off

**Test Suite Status:**
- [ ] All tests PASSED — Ready for production
- [ ] Some tests FAILED — Requires fixes
- [ ] Critical issues found — Block deployment

**Approved For Release:** YES / NO

**QA Signature:** ________________________ &nbsp;&nbsp; **Date:** ____________

---

## 📚 Reference Information

### File Locations

- **Chat Service:** `p2p-kids-marketplace/src/services/chat.ts`
- **Chat Screen:** `p2p-kids-marketplace/src/screens/messaging/ChatScreen.tsx`
- **Storage Migration:** `supabase/migrations/082_create_chat_images_bucket.sql`
- **Unit Tests:** `p2p-kids-marketplace/src/services/__tests__/chat-images.test.ts`

### Useful Commands

```bash
# Install dependencies
npm install

# Run tests
npm test -- --testPathPattern=chat-images

# Type check
npm run type-check

# Lint code
npm run lint
```

### Support Contacts

For issues or questions:
- **Development:** Check console logs in developer tools
- **Debugging:** Enable verbose logging in chat service
- **Supabase:** Check Storage console for upload failures