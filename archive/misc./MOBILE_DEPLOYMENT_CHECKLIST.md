# Mobile Deployment - Setup Checklist

## Initial One-Time Setup

Complete these steps once to prepare your environment.

### Prerequisites Check
- [ ] Xcode installed and working
- [ ] Android Studio installed and working
- [ ] Expo account created at https://expo.dev
- [ ] Google Play Developer account created
- [ ] iOS device (iPhone) available
- [ ] Android device (Google Pixel) available

### Install Required Tools
- [ ] Install EAS CLI: `npm install -g eas-cli`
- [ ] Verify EAS: `eas --version` (should show version)
- [ ] Install CocoaPods: `sudo gem install cocoapods`

### Authenticate & Link Project
- [ ] Login to Expo: `eas login`
- [ ] Navigate to: `/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace`
- [ ] Link project: `eas project:init` (if not already linked)
- [ ] Verify linking: Check `app.json` for owner + slug fields

### Configure Environment
- [ ] Copy env file: `cp .env.local.example .env.local`
- [ ] Add all API keys to `.env.local`:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `EXPO_PUBLIC_AMPLITUDE_API_KEY`
  - `EXPO_PUBLIC_SENDGRID_API_KEY`
- [ ] Verify env: `cat .env.local` (should show all keys)

### Install Dependencies
- [ ] Go to app directory
- [ ] Run: `npm install`
- [ ] Complete when no errors appear

---

## First Device Tests

### iOS Simulator (Easiest)
- [ ] Start Xcode: `open -a Simulator`
- [ ] Run `expo start` from app directory
- [ ] Press `i` to open iOS Simulator
- [ ] App loads successfully
- [ ] Can navigate through app

### Android Physical Device
- [ ] Connect Pixel via USB cable
- [ ] Verify: `adb devices` (should show device)
- [ ] Enable Developer Mode on device (tap Build Number 7x)
- [ ] Enable USB Debugging in Developer Options
- [ ] Answer "Always Allow" when prompted for USB access
- [ ] Build: `eas build --platform android --profile internal`
- [ ] Wait for build to complete (~12-20 minutes)
- [ ] Download APK when ready
- [ ] Install: `adb install ~/Downloads/<app>.apk`
- [ ] Launch app from device home screen
- [ ] App runs without crashing

---

## First OTA Update (After Successful Builds)

- [ ] Make a test code change (e.g., change a string in a label)
- [ ] Run: `eas update --channel staging`
- [ ] Wait for publish to complete (~1-2 minutes)
- [ ] On iOS Simulator: Close and reopen app (or wait ~30 seconds)
- [ ] Verify your change appears
- [ ] On Pixel: Close and reopen app (or wait ~30 seconds)
- [ ] Verify your change appears on Android too

---

## Deployment Workflows

### For Daily Development (Quick Iteration)
- [ ] Run: `expo start`
- [ ] Press `i` for iOS
- [ ] Make changes, see hot reload
- [ ] Press `a` for Android when ready to test there
- [ ] Uses Expo Go for instant feedback

### For Full Testing (Before Release)
- [ ] Build iOS: `eas build --platform ios --profile development`
- [ ] Build Android: `eas build --platform android --profile internal`
- [ ] Download both builds
- [ ] Test thoroughly on both devices
- [ ] Verify all features work
- [ ] Test against staging environment

### For Releasing to Users
- [ ] **Only after full testing above**
- [ ] Run: `eas update --channel production`
- [ ] Users receive update automatically within ~30 seconds
- [ ] Monitor app for any critical issues

---

## Troubleshooting Checklist

### iOS Simulator Won't Open
- [ ] Restart Xcode
- [ ] Run: `killall Simulator`
- [ ] Then: `open -a Simulator`
- [ ] Check Simulator → Device → Console for error messages

### Android Device Not Recognized
- [ ] Unplug device
- [ ] Run: `adb kill-server`
- [ ] Run: `adb start-server`
- [ ] Plug device back in
- [ ] Ensure USB Debugging is ON
- [ ] Approve USB connection permission

### App Crashes on Launch
- [ ] Check environment variables: `echo $EXPO_PUBLIC_SUPABASE_URL`
- [ ] Verify .env.local has all required keys
- [ ] Check console logs:
  - iOS: Simulator → Device → Console
  - Android: `adb logcat | grep marketplace`
- [ ] Try clearing app data:
  - iOS: Simulator → Settings → General → iPhone Storage → [App] → Delete App
  - Android: `adb shell pm clear com.p2pkids.marketplace`

### Build Fails
- [ ] Ensure you're logged in: `eas whoami`
- [ ] Check build logs: `eas build:list` → click build → view logs
- [ ] For Android: Follow prompts for Google Play credentials (first time only)
- [ ] Try clean build: Pass `--clear-cache` flag

---

## Quick Commands Reference

```bash
# Navigation
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Development
expo start              # Start dev server
npm run ios             # iOS quick run
npm run android         # Android quick run

# Building
eas build --platform ios --profile development        # iOS Simulator build
eas build --platform android --profile internal       # Android APK build
eas build:list          # See all your builds
eas build:view <id>     # View specific build details

# Updates
eas update --channel staging             # Test update
eas update --channel production          # Release to all users
eas update:list         # See update history

# Device Management
adb devices             # List connected Android devices
adb logcat | grep marketplace  # View Android logs
xcrun simctl list devices      # List iOS simulators

# Verification
eas whoami              # Check login status
expo whoami             # Check Expo login
```

---

## Important Notes

⚠️ **Before Production Release:**
1. Test thoroughly on both devices
2. Test against staging environment (not production DB)
3. Verify all critical flows work
4. Check logs for any warnings
5. Have rollback plan ready (older version available)

⚠️ **Google Play Internal Testing:**
- APK built with `--profile internal` is for testing only
- To release to users, use `--profile production` (creates App Bundle)
- Internal testing track doesn't affect production users

⚠️ **OTA Updates:**
- Only work for JavaScript changes
- Don't work for native code changes
- Don't require App Store/Play Store review
- Deploy to staging first, then production

---

## When You're Stuck

1. **Check the logs first** - they usually tell you exactly what's wrong
2. **Verify environment variables** - 90% of issues are missing API keys
3. **Try the clean approach** - `npm install`, `adb uninstall`, `eas build:view <id>` to check logs
4. **Google the exact error** - EAS logs are usually searchable online
5. **Use Expo docs** - https://docs.expo.dev/ is comprehensive

---

**Last Updated**: March 28, 2026  
**Status**: Ready to begin setup  
