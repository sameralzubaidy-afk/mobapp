# Mobile App Deployment Guide
## iOS Simulator + Android Physical Device (Google Pixel)

This guide covers deploying the Kids P2P Marketplace app to:
- **iOS**: Simulator (on your Mac with Xcode)
- **Android**: Physical Pixel device via Google Play Internal Testing Track

**Estimated Setup Time**: 30-45 minutes (first time), 5-10 minutes (subsequent iterations)

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Initial Setup (First Time Only)](#initial-setup-first-time-only)
3. [iOS Simulator Deployment](#ios-simulator-deployment)
4. [Android Physical Device Deployment](#android-physical-device-deployment)
5. [Over-the-Air (OTA) Updates](#over-the-air-ota-updates)
6. [Troubleshooting](#troubleshooting)
7. [Quick Reference](#quick-reference)

---

## Prerequisites

### Required Software (Already Have ✅)
- ✅ Xcode (for iOS Simulator)
- ✅ Android Studio
- ✅ Expo account (created)
- ✅ Google Play Developer account

### Required Software (Need to Install)
- ❌ EAS CLI (Expo Application Services)
- ❌ CocoaPods (for iOS dependencies)

### Hardware
- ✅ 1 iOS device (iPhone) - will use Simulator for now
- ✅ 1 Android physical device (Google Pixel)

---

## Initial Setup (First Time Only)

### Step 1: Install EAS CLI

```bash
# Install globally
npm install -g eas-cli

# Verify installation
eas --version
```

**Expected output**: `eas-cli/X.X.X` (version number)

### Step 2: Authenticate with Expo

```bash
# Navigate to your mobile app directory
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Login to Expo
eas login

# Follow the prompts to authenticate
# - Enter your Expo username
# - Enter your Expo password
# - Choose device (macOS) if prompted
```

**Expected output**: 
```
✅ Logged in as <your-username>
```

### Step 3: Link Project to Expo (if not already linked)

```bash
# Check if already linked
cat app.json | grep -A 5 '"owner"'

# If not linked, run:
eas project:init

# This will:
# - Ask for project name (use: p2p-kids-marketplace)
# - Create/link your project to Expo
```

### Step 4: Install iOS/Android Dependencies Locally

```bash
# Install Node dependencies
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
npm install

# Install CocoaPods (for iOS)
sudo gem install cocoapods

# (Already have Xcode, so iOS tools are available)
```

### Step 5: Verify Environment Variables

```bash
# Check that .env.local exists with all required keys
ls -la .env.local

# Required keys (verify they're all present):
# EXPO_PUBLIC_SUPABASE_URL
# EXPO_PUBLIC_SUPABASE_ANON_KEY
# EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
# EXPO_PUBLIC_AMPLITUDE_API_KEY
# EXPO_PUBLIC_SENDGRID_API_KEY
# etc.

# If any are missing, copy from .env.local.example and fill in:
cp .env.local.example .env.local
# Then edit with your actual keys
```

**If using staging environment:**
```bash
# For staging, also verify:
ls -la .env.staging
```

---

## iOS Simulator Deployment

### Option A: Quick Testing with Expo Go (Simplest)

**Use this for rapid iteration - app runs in Expo Go container**

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Start the development server
expo start

# In the terminal output, you'll see:
# → Local:   exp://192.168.X.X:19000
# → Tunnel:  exp://<tunnel-url>

# Press 'i' to open iOS Simulator
# (or press 'w' to open web, 'a' for Android)

# App will load in Simulator within ~30 seconds
```

**Pros:**
- Fastest iteration (change code → hot reload in ~2-5 seconds)
- No build required

**Cons:**
- Limited to Expo Go capabilities (no custom native modules)
- Some features may not work if they require native code

### Option B: Production Build (Best for Testing)

**Use this for more thorough testing - app runs as it would on real device**

#### Step 1: Build for iOS Simulator

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Build for iOS Simulator (local)
eas build --platform ios --profile development

# This will:
# - Build on Expo's servers
# - Download ~500MB (first time)
# - Produce a .app file
# - Takes ~8-15 minutes
```

**You'll see output like:**
```
Building for iOS...
⠙ Building
Build ID: <build-id>
Status: running

...waiting...

✅ Build finished successfully!
📱 iOS Simulator build: <download-url>
```

#### Step 2: Download & Install Build

```bash
# When build completes, you'll see a download link
# Click it or run:
eas build:list

# Find your recent build and download the .app file
# Or follow the download link directly

# Once downloaded, with iOS Simulator running:
xcrun simctl install booted ~/Downloads/<app-name>.app

# Or drag and drop the .app into the Simulator
```

#### Step 3: Launch in Simulator

```bash
# iOS Simulator should be running (or open it):
open -a "Simulator"

# Find the app icon "p2p-kids-marketplace" and tap to launch
# Or use:
xcrun simctl launch booted com.anonymous.p2p-kids-marketplace
```

### Option C: Local Prebuild + Run (Advanced, Fastest Large Iterations)

**Use this if you're making changes and want faster rebuilds**

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Prebuild native projects locally (first time only)
npx expo prebuild --platform ios --clean

# Then run on iOS Simulator directly
npm run ios

# This builds locally (~3-5 minutes first time)
# Subsequent rebuilds are faster (~1-2 minutes)
```

---

## Android Physical Device Deployment

### Step 1: Prepare Your Pixel Device

1. **Connect via USB**
   ```bash
   # Verify connection
   adb devices
   
   # Expected output:
   # List of attached devices
   # <device-id>  device
   ```

2. **Enable Developer Mode**
   - Go to **Settings → About Phone → Build Number**
   - Tap **Build Number 7 times** until "Developer Mode" appears

3. **Enable USB Debugging**
   - Go to **Settings → Developer Options → USB Debugging**
   - Toggle **ON**

4. **Allow USB Connection**
   - When Pixel asks "Allow USB debugging?", tap **Always Allow**

### Step 2: Build for Google Play Internal Testing Track

**This creates an APK signed with your Google Play key**

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Build for internal testing
eas build --platform android --profile internal

# This will:
# - Request Google Play credentials (one-time)
# - Build on Expo servers
# - Takes ~12-20 minutes
```

**Expected output:**
```
Building for Android...
⠙ Building
Build ID: <build-id>
Status: running

...waiting...

✅ Build finished successfully!
📱 Android APK: <download-url>
```

### Step 3: Download APK to Your Computer

```bash
# Option A: Click the download link from the build output
# This downloads to ~/Downloads/

# Option B: Use eas-cli to download
eas build:list
# Find your recent Android build and copy the URL
```

### Step 4: Install on Physical Device

```bash
# Connect your Pixel via USB
adb devices

# Install the APK directly
adb install ~/Downloads/<app-name>.apk

# Expected output:
# Success

# Or if reinstalling:
adb install -r ~/Downloads/<app-name>.apk
```

### Step 5: Launch the App

```bash
# Find the app on your device home screen: "p2p-kids-marketplace"
# Tap to launch

# Or launch via adb:
adb shell am start -n com.p2pkids.marketplace/.MainActivity
```

### Step 6: Upload to Google Play Console (Optional, for Testing Track)

**If you want to test the Play Store delivery:**

1. Go to [Google Play Console](https://play.google.com/console)
2. Select **p2p-kids-marketplace**
3. Navigate to **Testing → Internal Testing**
4. **Create Release:**
   - Upload the APK from your local `~/Downloads/`
   - Add release notes (e.g., "Development build v1.0.1")
   - Review and publish

5. **Add Testers:**
   - Add your Google account email
   - Wait for draft status to become active (~15 minutes)

6. **Install from Play Store:**
   - On your Pixel, open **Google Play Store**
   - Search for "p2p-kids-marketplace"
   - Tap **Become a Tester**
   - Tap **Install**

---

## Over-the-Air (OTA) Updates

### What is OTA?
- Push code changes **without rebuilding the app**
- Users get updates within ~30 seconds
- Only works for JS/TypeScript changes (not native code)

### Enable OTA Updates

Your `eas.json` already has this configured. Verify:

```bash
cat eas.json | grep -A 5 "channel"

# Should show:
# "staging": { "channel": "staging", ... }
# "production": { "channel": "production", ... }
```

### Deploy OTA Update

#### To Staging (your test devices only)

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Make your code changes
# git add + git commit recommended

# Deploy OTA update to staging
eas update --channel staging

# Output:
# ✅ Update published
# 🔗 Url: https://exp.host/updates/<id>
```

#### To All Users (Production)

```bash
# Only after staging verification!

eas update --channel production

# ⚠️ PRODUCTION USERS GET UPDATE WITHIN 30 SECONDS
```

### How Users Receive OTA Updates

1. User opens app
2. App checks for updates (automatic)
3. If found, downloads in background (user keeps using app)
4. Next time app is restarted, new version loads
5. No App Store/Play Store review needed ✅

---

## Workflow: Typical Iteration Cycle

### For Quick Testing (Simulator + Expo Go)

```bash
# 1. Start development server
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
expo start

# 2. Press 'i' for iOS Simulator
# App loads in ~30 seconds

# 3. Make code changes
# File → Save → Hot reload (automatic)

# 4. Test on Android
# Press 'a' for Android Device
# Connect Pixel, press 'a'
# App loads in ~30 seconds

# Cost: ~2-3 minutes per iteration
# Perfect for: UI tweaks, logic changes
```

### For Full Testing (Production Builds)

```bash
# 1. Make all your changes locally
# Test with `expo start` first

# 2. Build for both platforms
eas build --platform ios --profile development &
eas build --platform android --profile internal

# 3. Wait for builds (~8-20 minutes)

# 4. Download and install APK on Pixel
adb install ~/Downloads/<app>.apk

# 5. Download and install .app on Simulator
# (or use eas-cli to download)

# 6. Test thoroughly on both devices

# 7. When ready to push to all users:
eas update --channel production

# Cost: ~20-30 minutes for full build cycle
# Perfect for: Major changes, before releasing
```

### For Quick OTA Updates (No Rebuild)

```bash
# 1. You've already built and deployed v1.0.0

# 2. Make code-only changes (no native code)

# 3. Deploy OTA update
eas update --channel staging

# Test on your devices (gets update automatically)

# 4. When verified, deploy to production
eas update --channel production

# Cost: ~5 minutes total
# Users get update ~30 seconds after you publish
```

---

## Troubleshooting

### iOS Simulator Issues

#### "Simulator not found"
```bash
# Open Simulator manually
open -a "Simulator"

# Or check installed simulators
xcrun simctl list devices

# Create a new one if needed
xcrun simctl create "iPhone 15" "com.apple.CoreSimulator.CoreSimulatorDeviceType.iPhone-15" "com.apple.CoreSimulator.CoreSimulatorRuntime.iOS-17-4"
```

#### "Can't connect to Expo server"
```bash
# Use local network instead of tunnel
expo start --localhost

# Press 'i' for Simulator
```

#### "App crashes on launch"
```bash
# Check Simulator console for errors:
# Simulator → Device → Console

# Verify .env.local has all required keys
cat .env.local

# Rebuild with development profile
eas build --platform ios --profile development
```

### Android Device Issues

#### "Device not showing in `adb devices`"
```bash
# Restart adb
adb kill-server
adb start-server

# Check again
adb devices

# If still not showing:
# - Unplug and replug USB
# - Toggle USB Debugging OFF/ON
# - Accept USB debugging permission again
```

#### "Installation fails: insufficient space"
```bash
# Check available space
adb shell df /data

# If full, uninstall old builds:
adb uninstall com.p2pkids.marketplace

# Then reinstall
adb install ~/Downloads/<app>.apk
```

#### "App crashes on launch"
```bash
# Check device logs
adb logcat | grep -i "marketplace"

# Clear app data
adb shell pm clear com.p2pkids.marketplace

# Reinstall
adb install -r ~/Downloads/<app>.apk
```

#### "Build fails with 'Google Play credentials'"
```bash
# First-time Android build requires Google Play setup
# Follow EAS prompts to authenticate

# It will ask for:
# - Google account email
# - Password
# - App signing key location

# Once authenticated, builds work automatically
```

### Environment Variable Issues

#### "API keys not loading"
```bash
# Verify .env.local exists
ls -la .env.local

# Verify format (must start with EXPO_PUBLIC_)
cat .env.local | head -5

# Reload environment
source .env.local

# Verify in app code
echo $EXPO_PUBLIC_SUPABASE_URL
```

#### "Different Firebase project than expected"
```bash
# Check which Firebase project is being used
grep -r "com.google.gms.google-services" Plugins/ node_modules/

# Verify google-services.json in android/app/
ls -la android/app/google-services.json
```

---

## Configuration Files

### Current `eas.json` (Already Configured ✅)

Your `eas.json` includes:
- **development**: For iOS Simulator testing
- **staging**: Internal testing track, staging environment
- **production**: App Store/Play Store releases

No changes needed - configuration is ready!

### Current `app.json` (Already Configured ✅)

Your `app.json` includes:
- Bundle IDs for iOS and Android
- Icon/splash screen config
- Deep linking scheme: `p2pkidsmarketplace://`

No changes needed - configuration is ready!

---

## Quick Reference

### One-Time Setup (First Time)
```bash
npm install -g eas-cli
eas login
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
npm install
eas project:init  # if not already linked
```

### iOS Simulator - Option A (Fastest)
```bash
expo start
# Press 'i'
```

### iOS Simulator - Option B (Production Build)
```bash
eas build --platform ios --profile development
# Download and install .app
```

### Android Physical Device
```bash
adb devices  # Verify connection
eas build --platform android --profile internal
adb install ~/Downloads/<app>.apk
```

### Push OTA Update
```bash
eas update --channel staging   # Test first
# Then:
eas update --channel production  # Release to all
```

### Check Build Status
```bash
eas build:list
eas update:list
```

### View Logs
```bash
# iOS Simulator
xcrun simctl boot booted  # Start simulator
xcrun simctl spawn booted log stream --level debug

# Android Device
adb logcat | grep "marketplace"
```

---

## Next Steps

1. **First Time**: Complete "Initial Setup" section
2. **Test iOS**: Use "Option A" (Expo Go) for fastest feedback
3. **Test Android**: Connect Pixel and deploy APK
4. **Iterate**: Make changes and re-deploy
5. **Push Updates**: Use OTA updates for code-only changes
6. **Monitor**: Check logs and test features thoroughly

---

## Support

If you encounter issues not covered here:

1. Check EAS docs: https://docs.expo.dev/build/
2. Check Expo docs: https://docs.expo.dev/
3. Android Studio docs: https://developer.android.com/studio/run/managing-avds
4. Xcode docs: https://developer.apple.com/xcode/

---

**Last Updated**: March 28, 2026  
**Status**: Ready for deployment  
