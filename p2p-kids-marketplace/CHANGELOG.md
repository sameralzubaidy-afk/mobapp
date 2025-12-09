## Changelog - iOS native build fixes

### 2025-12-09 - Native build fixes

- Upgraded react-native-safe-area-context to 5.x (node_modules v5.6.2 installed) to resolve iOS C++ compile issues.
- Upgraded react-native-gesture-handler to 2.29.x to ensure compatibility with latest RN core build.
- Re-ran `yarn install` and `cd ios && pod install --repo-update` to refresh Pod artifacts.
- Verified Xcode Debug build (iPhone 17 Pro simulator) completes successfully.

Notes:
- If you encounter native compile issues in the future, re-run `yarn install` and `pod install` and ensure DerivedData is cleared.

Commands used:

```bash
# Node deps (yarn preferred)
yarn install --network-concurrency 1

# Update CocoaPods after native deps change
cd ios && pod install --repo-update

# Build from terminal
xcodebuild -workspace ios/p2pkidsmarketplace.xcworkspace -scheme p2pkidsmarketplace -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -configuration Debug -allowProvisioningUpdates clean build

``` 
