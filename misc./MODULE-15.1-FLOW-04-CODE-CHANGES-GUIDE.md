# MODULE-15.1 FLOW-04: Quick Implementation Guide (Code Changes)

**IMPORTANT:** This task is VISUAL-ONLY (StyleSheet + icons). DO NOT change:
- Business logic (supabase calls, validation, navigation)
- State management (useState, useReducer)
- Component prop types
- Data models

---

## Summary of Changes per Screen

### 1. ListingSafetyReviewScreen.tsx (COMPLETE EXAMPLE)

**What to Change:**
1. Add Phosphor icon imports at top
2. Update StyleSheet colors to match design system
3. Add ShieldWarning icon to alert banner JSX

**Import Changes (Add after existing imports):**
```typescript
// ADD THIS after other imports
import { ShieldWarning, WarningCircle } from 'phosphor-react-native';
```

**StyleSheet Changes (Replace entire styles object):**
```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Changed from #F7F8FA
  },
  content: {
    padding: 20, // Changed from 16 to match 20-24px spec
    gap: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '600', // Changed from '700'
    color: '#1A1A1A', // Changed from #111827
    marginBottom: 8,
  },
  helperText: {
    marginTop: 12,
    color: '#6B6B6B', // Changed from #4B5563
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  image: {
    width: '100%',
    height: 180,
    borderRadius: 8, // Changed from 10
    marginBottom: 12,
  },
  imagePlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: '#F0F0F0', // Changed from #E5E7EB
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    color: '#6B6B6B',
    fontWeight: '600',
  },
  itemTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A', // Changed from #111827
  },
  itemPrice: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A', // Changed from #2563EB
  },
  
  // ALERT BANNER (KEY CHANGE - #FEE2E2 background)
  alertBanner: {
    backgroundColor: '#FEE2E2', // DESIGN SYSTEM: safety alert red tint
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  alertText: {
    fontSize: 14,
    color: '#E85D75', // DESIGN SYSTEM: danger text
    flex: 1,
  },

  // Status badges
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12, // Pill shape
  },
  statusFlagged: {
    backgroundColor: '#FEF3C7', // Pending orange
  },
  statusRejected: {
    backgroundColor: '#FEE2E2', // Danger red
  },
  statusNeedsEdits: {
    backgroundColor: '#FED7AA', // Warning orange
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500', // Changed from '700'
  },
  statusTextFlagged: {
    color: '#D97706', // Amber
  },
  statusTextRejected: {
    color: '#E85D75', // DESIGN SYSTEM: danger
  },
  statusTextNeedsEdits: {
    color: '#D97706',
  },

  // Reason boxes
  reasonBox: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FEE2E2', // No separate border color
    padding: 10,
  },
  reasonTitle: {
    fontSize: 13,
    fontWeight: '500', // Changed from '700'
    color: '#E85D75',
    marginBottom: 4,
  },
  reasonText: {
    color: '#E85D75',
    lineHeight: 20,
  },
  
  needsEditsBox: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FEFCE8',
    padding: 10,
  },
  needsEditsTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#CA8A04',
    marginBottom: 4,
  },
  needsEditsText: {
    color: '#CA8A04',
    lineHeight: 20,
  },

  // Appeal box
  appealBox: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#F0F0F0', // DESIGN SYSTEM: filled input style
    borderWidth: 0, // NO border
    padding: 10,
  },
  appealTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  appealInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: '#1A1A1A',
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  appealHelperText: {
    fontSize: 12,
    color: '#6B6B6B',
    marginTop: 4,
    textAlign: 'right',
  },

  // Info boxes
  infoBox: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#E8F5F0', // Active green tint
    padding: 10,
  },
  infoText: {
    color: '#5DBB8E', // DESIGN SYSTEM: primary green
    lineHeight: 20,
  },
  infoBoxNeedsEdits: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    padding: 10,
  },
  infoTextNeedsEdits: {
    color: '#D97706',
    lineHeight: 20,
  },

  // Meta rows
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  metaLabel: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  metaValue: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },

  // BUTTONS (KEY CHANGES)
  
  // PRIMARY BUTTON (Green pill for normal actions)
  primaryButton: {
    backgroundColor: '#5DBB8E', // DESIGN SYSTEM: primary green
    borderRadius: 26, // DESIGN SYSTEM: pill = height ÷ 2
    height: 52,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // DANGER BUTTON (Red pill for Remove Listing - TC-017)
  dangerButton: {
    backgroundColor: '#E85D75', // DESIGN SYSTEM: danger red (NOT green!)
    borderRadius: 26, // Pill shape
    height: 52,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // SECONDARY BUTTON (Outlined for Appeal - TC-018)
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#6B6B6B', // DESIGN SYSTEM: gray border
    borderRadius: 24, // DESIGN SYSTEM: pill = 48 ÷ 2
    height: 48,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent', // NO fill
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#6B6B6B', // DESIGN SYSTEM: gray text (NOT white)
    fontSize: 16,
    fontWeight: '500',
  },

  // Ghost button
  ghostButton: {
    backgroundColor: 'transparent',
    borderRadius: 24,
    height: 48,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  ghostButtonText: {
    color: '#6B6B6B',
    fontSize: 16,
    fontWeight: '500',
  },

  // Disabled state
  disabledButton: {
    opacity: 0.5,
  },

  // Error states
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E85D75',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 16,
  },
});
```

**JSX Changes (Find and replace the alert banner section):**

Find this:
```typescript
<View style={styles.reasonBox}>
  <Text style={styles.reasonTitle}>Rejection Reason</Text>
```

Add BEFORE it:
```typescript
{(isRejected || isFlagged || needsEdits) && (
  <View style={styles.alertBanner}>
    <ShieldWarning size={20} color="#E85D75" weight="regular" />
    <Text style={styles.alertText}>
      {isRejected 
        ? 'This listing was rejected by our safety team.'
        : isFlagged
          ? 'This listing is under safety review.'
          : 'This listing needs edits before approval.'}
    </Text>
  </View>
)}
```

---

### 2. MyListingsScreen.tsx Changes

**Import Changes:**
```typescript
// ADD after existing imports
import { Storefront, PencilSimple, Trash, DotsThree } from 'phosphor-react-native';
```

**StyleSheet Changes (Key sections):**
```typescript
// Header icon style (add)
headerContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingVertical: 16,
  gap: 8,
},
headerTitle: {
  fontSize: 24,
  fontWeight: '600',
  color: '#1A1A1A',
},

// Listing row thumbnail
thumbnail: {
  width: 72,
  height: 72,
  borderRadius: 8, // DESIGN SYSTEM: 8px radius
},

// Status badges (REPLACE existing badge styles)
badgeActive: {
  backgroundColor: '#E8F5F0', // DESIGN SYSTEM: light green
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: 12, // Pill
},
badgeActiveText: {
  fontSize: 12,
  color: '#5DBB8E', // DESIGN SYSTEM: green
  fontWeight: '500',
},
badgeSold: {
  backgroundColor: '#F5F5F5', // DESIGN SYSTEM: light gray
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: 12,
},
badgeSoldText: {
  fontSize: 12,
  color: '#6B6B6B', // DESIGN SYSTEM: gray
  fontWeight: '500',
},
badgeExpired: {
  backgroundColor: '#FEF9C3', // DESIGN SYSTEM: light yellow
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: 12,
},
badgeExpiredText: {
  fontSize: 12,
  color: '#CA8A04', // DESIGN SYSTEM: amber
  fontWeight: '500',
},
badgePending: {
  backgroundColor: '#FEF3C7', // DESIGN SYSTEM: light orange
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: 12,
},
badgePendingText: {
  fontSize: 12,
  color: '#D97706', // DESIGN SYSTEM: orange
  fontWeight: '500',
},

// Empty state
emptyStateIcon: {
  marginBottom: 16,
},
emptyStateText: {
  fontSize: 16,
  color: '#6B6B6B',
  marginBottom: 20,
},
emptyStateCTA: {
  backgroundColor: '#5DBB8E', // DESIGN SYSTEM: green pill
  borderRadius: 26,
  height: 52,
  paddingHorizontal: 32,
  justifyContent: 'center',
  alignItems: 'center',
},
emptyStateCTAText: {
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: '600',
},
```

**JSX Changes:**

Header (find existing header, replace with):
```typescript
<View style={styles.headerContainer}>
  <Storefront size={24} color="#5DBB8E" weight="regular" />
  <Text style={styles.headerTitle}>My Listings</Text>
</View>
```

Action icons (find action buttons, replace with):
```typescript
<TouchableOpacity onPress={() => handleEditListing(listing)}>
  <PencilSimple size={20} color="#6B6B6B" weight="regular" />
</TouchableOpacity>
<TouchableOpacity onPress={() => handleDeleteListing(listing)}>
  <Trash size={20} color="#6B6B6B" weight="regular" />
</TouchableOpacity>
<TouchableOpacity>
  <DotsThree size={20} color="#6B6B6B" weight="regular" />
</TouchableOpacity>
```

Empty state (find empty state, replace with):
```typescript
<View style={styles.emptyStateContainer}>
  <Storefront size={64} color="#E0E0E0" weight="regular" style={styles.emptyStateIcon} />
  <Text style={styles.emptyStateText}>No listings yet</Text>
  <TouchableOpacity
    style={styles.emptyStateCTA}
    onPress={() => navigation.navigate('ItemCreate')}
  >
    <Text style={styles.emptyStateCTAText}>Create Listing</Text>
  </TouchableOpacity>
</View>
```

---

### 3. ItemCreateScreen.tsx Changes

**Import Changes:**
```typescript
// ADD after existing imports
import { Camera, Coins, Tag } from 'phosphor-react-native';
```

**StyleSheet Changes (Add to existing styles):**
```typescript
// SP Earn Badge (add)
spEarnBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#FEF3C7', // DESIGN SYSTEM: gold
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 4,
  alignSelf: 'flex-start',
  gap: 4,
  marginTop: 8,
},
spEarnBadgeText: {
  fontSize: 13,
  color: '#F59E0B', // DESIGN SYSTEM: gold text
  fontWeight: '500',
},

// Photo slot empty (add)
photoSlotEmpty: {
  aspectRatio: 1,
  backgroundColor: '#F0F0F0',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#E0E0E0',
  borderStyle: 'dashed',
  justifyContent: 'center',
  alignItems: 'center',
},

// Filled inputs (UPDATE existing or add)
input: {
  backgroundColor: '#F0F0F0', // DESIGN SYSTEM: filled style
  borderRadius: 12,
  height: 52,
  paddingHorizontal: 16,
  fontSize: 16,
  color: '#1A1A1A',
  borderWidth: 0, // NO border
},
inputMultiline: {
  backgroundColor: '#F0F0F0',
  borderRadius: 12,
  paddingHorizontal: 16,
  paddingVertical: 12,
  fontSize: 16,
  color: '#1A1A1A',
  borderWidth: 0,
  minHeight: 100,
},

// Publish button (UPDATE existing)
publishButton: {
  backgroundColor: '#5DBB8E', // DESIGN SYSTEM: green
  borderRadius: 26, // DESIGN SYSTEM: pill
  height: 52,
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 20,
},
publishButtonText: {
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: '600',
},
```

**JSX Changes:**

Empty photo slot (find photo grid rendering, add):
```typescript
{/* Empty photo slot */}
<TouchableOpacity style={styles.photoSlotEmpty} onPress={handleAddPhoto}>
  <Camera size={32} color="#6B6B6B" weight="regular" />
</TouchableOpacity>
```

SP Earn Badge (add after price input):
```typescript
{canAcceptSP && estimatedSP > 0 && (
  <View style={styles.spEarnBadge}>
    <Coins size={16} color="#F59E0B" weight="regular" />
    <Text style={styles.spEarnBadgeText}>Earn ~{estimatedSP} SP</Text>
  </View>
)}
```

Category selector button (find category button, add icon):
```typescript
<TouchableOpacity style={styles.categoryButton} onPress={() => setShowCategoryModal(true)}>
  <Tag size={20} color="#6B6B6B" weight="regular" />
  <Text style={styles.categoryButtonText}>
    {category ? category.name : 'Select Category'}
  </Text>
</TouchableOpacity>
```

---

### 4. EditListingScreen.tsx Changes

**Import Changes:**
Same as ItemCreateScreen (Camera, Coins, Tag)

**StyleSheet Changes:**
Copy ALL styles from ItemCreateScreen.tsx

Add these specific to Edit:
```typescript
saveButton: {
  backgroundColor: '#5DBB8E',
  borderRadius: 26,
  height: 52,
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 20,
},
saveButtonText: {
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: '600',
},
deleteLink: {
  fontSize: 14,
  color: '#E85D75', // DESIGN SYSTEM: danger red
  textAlign: 'center',
  paddingVertical: 12,
  marginTop: 8,
},
```

**JSX Changes:**
Replace "Publish Listing" button with "Save Changes"
Add delete link below button

---

### 5. BulkListingCreateScreen.tsx Changes

**Import Changes:**
```typescript
import { Camera, Package } from 'phosphor-react-native';
```

**StyleSheet Changes:**
Copy photo grid styles from ItemCreateScreen
Add:
```typescript
emptyState: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 24,
},
emptyStateText: {
  fontSize: 15,
  color: '#6B6B6B',
  marginTop: 12,
},
publishAllButton: {
  backgroundColor: '#5DBB8E',
  borderRadius: 26,
  height: 52,
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 20,
},
```

**JSX Changes:**
Empty state:
```typescript
{photos.length === 0 && (
  <View style={styles.emptyState}>
    <Package size={64} color="#E0E0E0" weight="regular" />
    <Text style={styles.emptyStateText}>Add photos to get started</Text>
  </View>
)}
```

---

## Implementation Order (Recommended)

1. ✅ **Start with ListingSafetyReviewScreen** (smallest, complete example above)
2. ✅ **Then MyListingsScreen** (header + status badges)
3. ✅ **Then ItemCreateScreen** (photo slots + SP badge + inputs)
4. ✅ **Then EditListingScreen** (copy ItemCreate styles)
5. ✅ **Finally BulkListingCreateScreen** (copy ItemCreate photo grid)

---

## Tier 0 Preflight (RUN AFTER EACH SCREEN)

After editing EACH screen file, run:
```bash
cd p2p-kids-marketplace
npm run typecheck  # Must pass
npm run lint        # Must pass
```

Fix any errors before continuing to next screen.

---

## Common Mistakes to AVOID

❌ **DO NOT:**
- Change prop types or component signatures
- Add/remove state variables
- Modify business logic (supabase calls, validation)
- Change navigation.navigate() calls
- Remove existing functionality

✅ **ONLY:**
- Update StyleSheet colors/sizes/radii
- Add Phosphor icon imports
- Replace icon JSX (Ionicons → Phosphor)
- Update button/input/badge styles to match design system

---

**End of Quick Implementation Guide**
