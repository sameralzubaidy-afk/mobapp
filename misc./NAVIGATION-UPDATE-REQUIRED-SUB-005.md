# NAVIGATION UPDATE REQUIRED

**File**: `p2p-kids-marketplace/src/navigation/AppNavigator.tsx`

The TrialConversionTestScreen import has been added successfully, but the route needs to be added manually.

## Action Required:

Add this line after line 184 (after ReviewModeration screen):

```typescript
            <Stack.Screen name="TrialConversionTest" component={TrialConversionTestScreen} options={{ title: 'Trial Conversion Test - SUB-005' }} />
```

The full context should look like:

```typescript
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
            <Stack.Screen name="ReviewModeration" component={ReviewModerationScreen} />
            <Stack.Screen name="TrialConversionTest" component={TrialConversionTestScreen} options={{ title: 'Trial Conversion Test - SUB-005' }} />
            <Stack.Screen name="IDVerificationUpload" component={IDVerificationUploadScreen} />
```

## To Navigate to the Test Screen:

From the app:
1. Home → Profile/Settings → Admin Dashboard → Trial Conversion Test

Or use navigation directly:
```typescript
navigation.navigate('TrialConversionTest');
```
