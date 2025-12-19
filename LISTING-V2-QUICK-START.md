# 🚀 LISTING-V2-006 & LISTING-V2-007: QUICK START GUIDE

## ✅ Implementation Status

- ✅ ListingSearch.tsx component (444 lines) - FULLY IMPLEMENTED
- ✅ ListingAnalytics.tsx component (268 lines) - FULLY IMPLEMENTED  
- ✅ Navigation link added to admin portal - JUST FIXED
- ✅ Route `/listings` created - JUST FIXED
- ✅ TypeScript compilation - PASS

---

## 🎯 How to Access Listings Management

### Step 1: Start Admin Portal
```bash
cd p2p-kids-admin
npm run dev
# or
yarn dev
```

### Step 2: Open in Browser
```
http://localhost:3000
```

### Step 3: Login
- Use your admin credentials (must have `is_admin: true` in metadata)

### Step 4: Click "Listings" in Navigation Bar
![Navigation Bar]
```
P2P Kids Admin | [Listings] | Configuration | Nodes | Users | Audit Logs | [Email] | Logout
                ↑ Click Here
```

---

## 📋 Features Available

### Tab 1: Search & Manage
**URL**: `http://localhost:3000/listings` (default tab)

**Features**:
- 🔍 Search by ID, seller ID, or item name
- 📊 Filter by status (Active, Paused, Deleted)
- 💙 Filter by SP-eligible listings
- 🎯 Click any listing to view details
- 🗑 Force-delete with reason logging
- ⏸ Pause/unpause listings
- 📋 View seller name, price, SP status, created date

**Example Search**:
1. Type listing ID: `809241eb-...`
2. Select status: "Active"
3. Check "SP-Eligible Only"
4. Click "Search"
5. Results appear in table
6. Click a listing to see details panel
7. Click "Force Delete" or "Pause Listing"
8. Enter reason (e.g., "Duplicate listing")
9. Confirm action

### Tab 2: Analytics Dashboard
**URL**: `http://localhost:3000/listings?tab=analytics`

**Metrics Displayed**:
- 📊 Active listing count + % of total
- 💙 SP-eligible count + adoption rate %
- ⏸ Paused listings count
- 🗑 Deleted listings count
- 💰 Price statistics (avg, min, max)
- 👥 Active seller count
- 📈 SP adoption rate progress bar
- 🏥 Community health percentage

**Auto-Refresh**:
- Refreshes every 60 seconds automatically
- Click "Refresh Now" for immediate update

---

## 🔧 Deployment Requirements

Before admin actions (force-delete, pause) will work, you MUST:

### 1. Apply Supabase Migration 042
```sql
-- Run in Supabase SQL Editor
-- Copy contents from: supabase/migrations/042_admin_listing_force_delete_and_pause.sql

-- Creates:
-- - admin_listing_actions table (audit trail)
-- - admin_force_delete_listing() RPC function
-- - admin_pause_listing() RPC function
-- - admin_unpause_listing() RPC function
-- - listing_admin_analytics view
```

### 2. Fix RLS Policy on Profiles Table
```sql
-- Run in Supabase SQL Editor
CREATE POLICY "Profiles are viewable by anyone" ON profiles
  FOR SELECT TO authenticated
  USING (true);
```

### 3. Setup Admin User Metadata
```
Supabase Dashboard → Auth → Users → Select admin user → Edit

Raw user metadata:
{
  "is_admin": "true"
}
```

---

## 🧪 Testing Checklist

- [ ] Can navigate to `/listings` from admin portal
- [ ] See "Search & Manage" tab selected by default
- [ ] Can type in search box
- [ ] Can select status filter
- [ ] Can toggle "SP-Eligible Only" checkbox
- [ ] "Search" button works (returns results or "No listings found")
- [ ] Can click a listing to see details panel
- [ ] Can see listing ID, title, price, SP status, status badge, seller name
- [ ] Can click "Pause Listing" or "Force Delete" buttons
- [ ] Get prompted to enter reason before action
- [ ] Can switch to "Analytics Dashboard" tab
- [ ] See metrics cards loading (or showing mock data if migration not applied)
- [ ] Can refresh metrics manually
- [ ] UI is responsive on mobile

---

## 🐛 Troubleshooting

### Issue: "Listings" link doesn't appear in navigation

**Solution**: 
- Clear browser cache: Ctrl+Shift+Del (or Cmd+Shift+Del on Mac)
- Restart dev server: `npm run dev`
- Hard refresh browser: Ctrl+F5

### Issue: Page shows "Loading..." forever

**Solution**:
- Check browser console for errors (F12)
- Verify Supabase connection: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in `.env.local`
- Check network tab to see if API calls are happening

### Issue: Force-delete/Pause buttons don't work

**Solution**:
- Check if migration 042 has been applied: 
  ```sql
  SELECT * FROM information_schema.tables WHERE table_name = 'admin_listing_actions';
  ```
- Check if you have `is_admin: true` in your user metadata
- Check browser console for error messages

### Issue: Analytics shows no data

**Solution**:
- Make sure migration 042 has been applied (creates the view)
- Make sure there are active listings in the database
- Try manual refresh by clicking "Refresh Now"
- Check if you're looking at a 30-day window (analytics filtered to last 30 days)

---

## 📁 File Structure

```
p2p-kids-admin/
├── src/app/
│   ├── components/
│   │   ├── ListingSearch.tsx          ← Search & manage component
│   │   ├── ListingAnalytics.tsx       ← Analytics dashboard component
│   │   ├── ProtectedLayout.tsx        ← Updated with Listings link
│   │   └── ...
│   ├── listings/
│   │   └── page.tsx                   ← NEW: Route handler
│   ├── config/
│   ├── nodes/
│   ├── auth/
│   └── ...
└── ...
```

---

## 🎨 UI Preview

```
┌─────────────────────────────────────────────────────────────┐
│ P2P Kids Admin | [Listings] | Configuration | ... | Logout  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Listing Management                                          │
│ Search, manage, and analyze listings with admin tools       │
│                                                             │
│ [Search & Manage] [Analytics Dashboard]                     │
├─────────────────────────────────────────────────────────────┤
│ 🔍 Search & Filter                                          │
│                                                             │
│ [Search Box]  [Status▼] [☐ SP-Only] [Search Button]       │
│                                                             │
│ Results (25)                                                │
│                                                             │
│ Item          │ Price  │ SP │ Status  │ Action            │
│ ─────────────────────────────────────────────────────────  │
│ Blue Backpack │ $25.00 │ ✓  │ Active  │ View              │
│ Red Toy Car   │ $15.00 │ -  │ Paused  │ View              │
│ Green Book    │ $8.50  │ ✓  │ Active  │ View              │
│                                                             │
│              ┌──────────────────────────────────┐           │
│              │ 📌 Listing Details               │           │
│              │                                  │           │
│              │ ID: 809241eb-...                 │           │
│              │ Title: Blue Backpack             │           │
│              │ Price: $25.00                    │           │
│              │ SP Eligible: ✓ Yes               │           │
│              │ Status: Active                   │           │
│              │ Created: 12/19/2025              │           │
│              │ Seller: John Smith               │           │
│              │                                  │           │
│              │ [⏸ Pause Listing]               │           │
│              │ [🗑 Force Delete]                │           │
│              │ [Close]                          │           │
│              └──────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Next Steps

1. ✅ Verify you can see "Listings" link in admin portal
2. ⏳ Apply migration 042 in Supabase (from `supabase/migrations/042_admin_listing_force_delete_and_pause.sql`)
3. ⏳ Fix RLS policy on profiles table
4. 🧪 Test search and force-delete functionality
5. 📈 Monitor `admin_listing_actions` audit table for logs

---

## 📞 Support

If you encounter issues, check:
- Browser console (F12 → Console tab) for errors
- Supabase logs (Supabase Dashboard → Logs)
- Network tab (F12 → Network) to see API calls
- This troubleshooting guide above

---

**Status**: 🟢 READY FOR TESTING  
**Created**: December 19, 2025  
**Module**: MODULE-04 Item Listing V2  

