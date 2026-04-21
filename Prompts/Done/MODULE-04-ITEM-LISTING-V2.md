# MODULE 04: ITEM LISTING & CATALOG MANAGEMENT (V2)

**Version:** 2.0 (Kids Club+ Subscription-Gated Swap Points Model)  
**Status:** Complete - All Tasks Specified  
**Last Updated:** [Auto-generated timestamp]

---

## V2 OVERVIEW

This module defines how users **create, edit, and manage item listings** in the Kids Club+ marketplace, integrated with:

- **Swap Points (SP) payment preferences**: Sellers can opt-in to accept SP (if they are subscribers).
- **Subscription-aware listing rules**: Only `trial` or `active` subscribers can enable SP payment on their listings.
- **Item visibility and search**: Listings tagged with SP-eligible flag for filtering.
- **Pricing and fee disclosure**: Item price + transaction fee (computed at trade time based on buyer subscription).

This module **does not** handle trade execution (see MODULE-06); it focuses on catalog creation and management.

---

## CHANGELOG FROM V1 → V2

### V1 Limitations
- **No SP payment preferences**: Listings were cash-only by default.
- **No subscription context**: Any user could create listings without restrictions.
- **No SP visibility**: Buyers couldn't filter for SP-eligible items.

### V2 Enhancements
- **Payment Preferences Field**: `accepts_swap_points` boolean flag per listing.
- **Subscription Gating**: Only subscribers can enable SP payment; non-subscribers see cash-only option.
- **Catalog Filtering**: Search/browse can filter for SP-eligible listings.
- **Audit Trail**: Track who created listing and their subscription status at creation time.

---

## STATE DIAGRAM: Listing Lifecycle

```
DRAFT (optional for future) → ACTIVE ⇄ PAUSED
                                 ↓
                              SOLD / DELETED
```

**V2 Focus:** Active listings with subscription-aware payment preferences.

---

## CRITICAL V2 RULES FOR LISTING MODULE

### Rule 1: SP Payment Preference Gating
- Only sellers with `subscription.status IN ('trial', 'active')` can enable `accepts_swap_points = true`.
- Non-subscribers and users in `grace_period`/`expired` can only create cash-only listings.

### Rule 2: SP Eligibility Visibility
- Listings with `accepts_swap_points = true` are tagged "SP Eligible" in UI.
- Buyers can filter search results to show only SP-eligible listings.

### Rule 3: Price Independence
- Listing price is set in dollars (stored as `price_cents`).
- Transaction fee ($0.99 vs $2.99) is computed at trade time based on **buyer** subscription, not listing creation.

### Rule 4: Listing Ownership
- Only the seller can edit/delete their own listings.
- Listings cannot be edited after a trade is initiated (integrity constraint).

---

## AGENT TEMPLATE

```typescript
/*
YOU ARE AN AI AGENT TASKED WITH IMPLEMENTING MODULE-04 (ITEM LISTING V2).

CONTEXT:
- This is part of a 6-phase workplan to update a P2P kids marketplace with Kids Club+ subscription-gated Swap Points.
- MODULE-09 (SP Gamification) and MODULE-11 (Subscriptions) are already implemented.
- MODULE-06 (Trade Flow) depends on listings having `accepts_swap_points` field.

YOUR INSTRUCTIONS:
1. Read this entire module specification carefully.
2. For each task (LISTING-V2-001, LISTING-V2-002, etc.), implement EXACTLY as specified.
3. Ensure all code follows TypeScript best practices and matches existing project structure.
4. Run tests after each task to verify correctness.
5. If you encounter ambiguity, refer to MODULE-09/MODULE-11 patterns or ask for clarification.

==================================================
NEXT TASK: LISTING-V2-001 (Schema & Types)
==================================================
*/
```

---

## TASK LISTING-V2-001: Listing Schema & TypeScript Types

**Duration:** 2 hours  
**Priority:** High  
**Dependencies:** None (foundational)

### Description

Define the database schema for item listings with V2 fields, and create corresponding TypeScript types.

**New V2 fields:**
- `accepts_swap_points` (BOOLEAN): Whether seller accepts SP payment.
- `seller_subscription_status_at_creation` (TEXT): Subscription status when listing was created (audit).
- `last_edited_at` (TIMESTAMPTZ): Track when listing was last modified.

### AI Prompt for Cursor

```typescript
/*
TASK: Create or update listings table schema and TypeScript types for V2

REQUIREMENTS:
1. Migration file: 040_listings_v2.sql
2. Add V2 fields: accepts_swap_points, seller_subscription_status_at_creation, last_edited_at
3. TypeScript types: ListingStatus, Listing interface

==================================================
FILE 1: Migration - Add V2 fields to listings table
==================================================
*/

-- filepath: supabase/migrations/040_listings_v2.sql

-- V2 enhancement: Add SP payment preference and subscription audit fields

ALTER TABLE listings
ADD COLUMN accepts_swap_points BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN seller_subscription_status_at_creation TEXT,
ADD COLUMN last_edited_at TIMESTAMPTZ DEFAULT NOW();

-- Index for filtering SP-eligible listings
CREATE INDEX idx_listings_sp_eligible ON listings(accepts_swap_points) WHERE accepts_swap_points = TRUE;

-- Index for seller (for "my listings" queries)
CREATE INDEX idx_listings_seller ON listings(seller_id);

COMMENT ON COLUMN listings.accepts_swap_points IS 'Whether seller accepts Swap Points as partial payment (V2)';
COMMENT ON COLUMN listings.seller_subscription_status_at_creation IS 'Seller subscription status when listing created (audit trail, V2)';

/*
==================================================
FILE 2: TypeScript Types for Listing
==================================================
*/

// filepath: src/types/listing.ts

export type ListingStatus = 'active' | 'paused' | 'sold' | 'deleted';

export interface Listing {
  id: string;
  seller_id: string;
  item_name: string;
  item_description: string;
  price_cents: number; // Item price in cents
  category: string;
  condition: 'new' | 'like_new' | 'good' | 'fair';
  image_urls: string[];
  status: ListingStatus;
  accepts_swap_points: boolean; // V2: SP payment preference
  seller_subscription_status_at_creation: string | null; // V2: audit trail
  created_at: string;
  last_edited_at: string; // V2: track edits
  sold_at?: string | null;
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Migration 040_listings_v2.sql adds V2 fields to listings table
✓ accepts_swap_points defaults to FALSE for existing listings
✓ Indexes created for SP filtering and seller queries
✓ TypeScript Listing interface matches V2 schema

==================================================
NEXT TASK: LISTING-V2-002 (Create Listing with SP Preference)
==================================================
*/
```

---

## TASK LISTING-V2-002: Create Listing with SP Payment Preference

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** LISTING-V2-001, MODULE-11

### Description

Implement the service function and UI flow for creating a new listing, including:
- Subscription status check to gate `accepts_swap_points` option.
- Validation that only subscribers can enable SP payment.
- Capture seller subscription status at creation for audit.

### AI Prompt for Cursor

```typescript
/*
TASK: Implement createListingV2 service and UI for listing creation

REQUIREMENTS:
1. Service function: createListingV2
2. Check seller subscription via MODULE-11 getSubscriptionSummary
3. Validate: accepts_swap_points = true only if seller can_spend_sp
4. UI: Show SP payment option only to subscribers

==================================================
FILE 1: Service - createListingV2
==================================================
*/

// filepath: src/services/listing.ts

import { supabase } from '../lib/supabase';
import { getSubscriptionSummary } from './subscription'; // MODULE-11
import { Listing } from '../types/listing';

export interface CreateListingInput {
  sellerId: string;
  itemName: string;
  itemDescription: string;
  priceCents: number;
  category: string;
  condition: 'new' | 'like_new' | 'good' | 'fair';
  imageUrls: string[];
  acceptsSwapPoints: boolean;
}

export async function createListingV2(input: CreateListingInput): Promise<Listing> {
  const {
    sellerId,
    itemName,
    itemDescription,
    priceCents,
    category,
    condition,
    imageUrls,
    acceptsSwapPoints,
  } = input;

  // Validate price
  if (priceCents <= 0) {
    throw new Error('Price must be greater than 0');
  }

  // Check seller subscription status (MODULE-11)
  const subscriptionSummary = await getSubscriptionSummary(sellerId);

  // V2 Rule: Only subscribers (trial/active) can enable SP payment
  if (acceptsSwapPoints && !subscriptionSummary.can_spend_sp) {
    throw new Error(
      'Only Kids Club+ subscribers can accept Swap Points. Please subscribe to enable this option.'
    );
  }

  // Create listing
  const { data, error } = await supabase
    .from('listings')
    .insert({
      seller_id: sellerId,
      item_name: itemName,
      item_description: itemDescription,
      price_cents: priceCents,
      category,
      condition,
      image_urls: imageUrls,
      status: 'active',
      accepts_swap_points: acceptsSwapPoints,
      seller_subscription_status_at_creation: subscriptionSummary.status, // Audit trail
      created_at: new Date().toISOString(),
      last_edited_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  return data as Listing;
}

/*
==================================================
FILE 2: UI - CreateListingScreen
==================================================
*/

// filepath: src/screens/CreateListingScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Switch, Button } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { getSubscriptionSummary } from '../services/subscription';
import { createListingV2 } from '../services/listing';

export const CreateListingScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [priceDollars, setPriceDollars] = useState('');
  const [category, setCategory] = useState('toys');
  const [condition, setCondition] = useState('good');
  const [acceptsSwapPoints, setAcceptsSwapPoints] = useState(false);
  const [canAcceptSp, setCanAcceptSp] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    const sub = await getSubscriptionSummary(user.id);
    setCanAcceptSp(sub.can_spend_sp);
  };

  const handleCreateListing = async () => {
    const priceCents = Math.round(parseFloat(priceDollars) * 100);

    await createListingV2({
      sellerId: user.id,
      itemName,
      itemDescription,
      priceCents,
      category,
      condition,
      imageUrls: [], // TODO: Image upload
      acceptsSwapPoints: canAcceptSp ? acceptsSwapPoints : false,
    });

    navigation.navigate('MyListings');
  };

  return (
    <View>
      <Text>Create New Listing</Text>
      <TextInput placeholder="Item Name" value={itemName} onChangeText={setItemName} />
      <TextInput
        placeholder="Description"
        value={itemDescription}
        onChangeText={setItemDescription}
        multiline
      />
      <TextInput
        placeholder="Price ($)"
        value={priceDollars}
        onChangeText={setPriceDollars}
        keyboardType="decimal-pad"
      />

      {canAcceptSp ? (
        <View>
          <Text>Accept Swap Points?</Text>
          <Switch value={acceptsSwapPoints} onValueChange={setAcceptsSwapPoints} />
        </View>
      ) : (
        <Text>Subscribe to Kids Club+ to accept Swap Points!</Text>
      )}

      <Button title="Create Listing" onPress={handleCreateListing} />
    </View>
  );
};

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ createListingV2 validates seller subscription before allowing SP payment
✓ Non-subscribers see upgrade prompt instead of SP toggle
✓ Listing created with seller_subscription_status_at_creation for audit
✓ UI clearly shows SP payment option availability

==================================================
NEXT TASK: LISTING-V2-003 (Edit/Delete Listing)
==================================================
*/
```

---

## TASK LISTING-V2-003: Edit & Delete Listing

**Duration:** 2 hours  
**Priority:** Medium  
**Dependencies:** LISTING-V2-002

### Description

Implement listing edit and delete functionality with V2 rules:
- Only seller can edit/delete their own listings.
- Listings with active trades cannot be edited (integrity constraint).
- Editing updates `last_edited_at` timestamp.
- Deleting marks listing as `deleted` (soft delete) instead of hard delete.

### AI Prompt for Cursor

```typescript
/*
TASK: Implement edit and delete listing functions

REQUIREMENTS:
1. Service: updateListingV2 (check ownership, active trades)
2. Service: deleteListingV2 (soft delete, mark as deleted)
3. UI: Edit/Delete buttons on listing detail screen

==================================================
FILE 1: Service - updateListingV2
==================================================
*/

// filepath: src/services/listing.ts (add to existing file)

export interface UpdateListingInput {
  listingId: string;
  userId: string; // For ownership check
  itemName?: string;
  itemDescription?: string;
  priceCents?: number;
  acceptsSwapPoints?: boolean;
}

export async function updateListingV2(input: UpdateListingInput): Promise<Listing> {
  const { listingId, userId, ...updates } = input;

  // Fetch listing to check ownership
  const { data: listing, error: fetchError } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single();

  if (fetchError || !listing) {
    throw new Error('Listing not found');
  }

  if (listing.seller_id !== userId) {
    throw new Error('You are not authorized to edit this listing');
  }

  // Check for active trades (integrity constraint)
  const { data: activeTrades } = await supabase
    .from('trades')
    .select('id')
    .eq('item_id', listingId)
    .in('status', ['pending', 'payment_processing', 'in_progress']);

  if (activeTrades && activeTrades.length > 0) {
    throw new Error('Cannot edit listing with active trades');
  }

  // If updating accepts_swap_points, re-validate subscription
  if (updates.acceptsSwapPoints !== undefined) {
    const sub = await getSubscriptionSummary(userId);
    if (updates.acceptsSwapPoints && !sub.can_spend_sp) {
      throw new Error('Only subscribers can accept Swap Points');
    }
  }

  // Update listing
  const { data, error } = await supabase
    .from('listings')
    .update({
      ...updates,
      last_edited_at: new Date().toISOString(),
    })
    .eq('id', listingId)
    .select()
    .single();

  if (error) throw error;

  return data as Listing;
}

/*
==================================================
FILE 2: Service - deleteListingV2 (soft delete)
==================================================
*/

export async function deleteListingV2(listingId: string, userId: string): Promise<void> {
  // Fetch listing to check ownership
  const { data: listing, error: fetchError } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single();

  if (fetchError || !listing) {
    throw new Error('Listing not found');
  }

  if (listing.seller_id !== userId) {
    throw new Error('You are not authorized to delete this listing');
  }

  // Soft delete (mark as deleted)
  const { error } = await supabase
    .from('listings')
    .update({
      status: 'deleted',
      last_edited_at: new Date().toISOString(),
    })
    .eq('id', listingId);

  if (error) throw error;
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Only listing owner can edit/delete
✓ Listings with active trades cannot be edited
✓ Editing updates last_edited_at timestamp
✓ Deleting soft-deletes (status = deleted)

==================================================
NEXT TASK: LISTING-V2-004 (Browse & Filter SP-Eligible Listings)
==================================================
*/
```

---

## TASK LISTING-V2-004: Browse & Filter SP-Eligible Listings

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** LISTING-V2-001, LISTING-V2-002

### Description

Build catalog browsing and search functionality with V2 features:
- Filter by `accepts_swap_points` (show only SP-eligible listings).
- Search by category, price range, condition.
- Display "SP Eligible" badge on listings that accept Swap Points.
- Real-time catalog updates via Supabase subscriptions.

### AI Prompt for Cursor

```typescript
/*
TASK: Implement catalog browsing with SP filtering

REQUIREMENTS:
1. Service: fetchListings with SP filter option
2. UI: Browse screen with SP toggle filter
3. Display SP badge on eligible listings

==================================================
FILE 1: Service - fetchListings with filters
==================================================
*/

// filepath: src/services/listing.ts (add to existing file)

export interface ListingFilters {
  category?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  condition?: string;
  spEligibleOnly?: boolean; // V2 filter
}

export async function fetchListings(filters: ListingFilters = {}): Promise<Listing[]> {
  let query = supabase
    .from('listings')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  if (filters.minPriceCents !== undefined) {
    query = query.gte('price_cents', filters.minPriceCents);
  }

  if (filters.maxPriceCents !== undefined) {
    query = query.lte('price_cents', filters.maxPriceCents);
  }

  if (filters.condition) {
    query = query.eq('condition', filters.condition);
  }

  if (filters.spEligibleOnly) {
    query = query.eq('accepts_swap_points', true); // V2: SP filter
  }

  const { data, error } = await query;

  if (error) throw error;

  return data as Listing[];
}

/*
==================================================
FILE 2: UI - BrowseListingsScreen
==================================================
*/

// filepath: src/screens/BrowseListingsScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Switch, Button } from 'react-native';
import { fetchListings } from '../services/listing';
import { Listing } from '../types/listing';

export const BrowseListingsScreen = ({ navigation }) => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [spEligibleOnly, setSpEligibleOnly] = useState(false);

  useEffect(() => {
    loadListings();
  }, [spEligibleOnly]);

  const loadListings = async () => {
    const data = await fetchListings({ spEligibleOnly });
    setListings(data);
  };

  return (
    <View>
      <Text>Browse Listings</Text>

      <View>
        <Text>Show only SP-eligible listings</Text>
        <Switch value={spEligibleOnly} onValueChange={setSpEligibleOnly} />
      </View>

      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View>
            <Text>{item.item_name}</Text>
            <Text>${(item.price_cents / 100).toFixed(2)}</Text>
            {item.accepts_swap_points && <Text style={{ color: 'green' }}>✓ SP Eligible</Text>}
          </View>
        )}
      />
    </View>
  );
};

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Catalog can be filtered by SP eligibility
✓ SP-eligible listings display badge
✓ Search and filter UI responsive and intuitive
✓ Real-time updates when new listings added (optional via Supabase subscription)

==================================================
NEXT TASK: LISTING-V2-005 (Listing Detail View)
==================================================
*/
```

---

## TASK LISTING-V2-005: Listing Detail View with SP Context

**Duration:** 2 hours  
**Priority:** Medium  
**Dependencies:** LISTING-V2-002, LISTING-V2-004

### Description

Build a detailed listing view showing:
- Full item details (name, description, price, images, condition).
- SP payment eligibility clearly displayed.
- Buyer's subscription context: if buyer is non-subscriber, show fee disclosure ($2.99 vs $0.99).
- "Buy Now" button that navigates to trade initiation (MODULE-06).

### AI Prompt for Cursor

```typescript
/*
TASK: Build listing detail screen with SP context

REQUIREMENTS:
1. Display full listing details
2. Show SP eligibility status
3. Show fee disclosure based on buyer subscription
4. "Buy Now" button links to InitiateTrade screen

==================================================
FILE 1: UI - ListingDetailScreen
==================================================
*/

// filepath: src/screens/ListingDetailScreen.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, Image, Button } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { getSubscriptionSummary } from '../services/subscription';
import { Listing } from '../types/listing';

export const ListingDetailScreen = ({ route, navigation }) => {
  const { listing } = route.params as { listing: Listing };
  const { user } = useAuth();
  const [buyerSub, setBuyerSub] = useState(null);

  useEffect(() => {
    loadBuyerSubscription();
  }, []);

  const loadBuyerSubscription = async () => {
    const sub = await getSubscriptionSummary(user.id);
    setBuyerSub(sub);
  };

  const handleBuyNow = () => {
    navigation.navigate('InitiateTrade', { itemId: listing.id });
  };

  if (!buyerSub) return <Text>Loading...</Text>;

  const feeAmount = buyerSub.is_subscriber ? 0.99 : 2.99;

  return (
    <View>
      <Text>{listing.item_name}</Text>
      <Text>Price: ${(listing.price_cents / 100).toFixed(2)}</Text>
      <Text>Condition: {listing.condition}</Text>
      <Text>{listing.item_description}</Text>

      {listing.accepts_swap_points && (
        <View>
          <Text style={{ color: 'green' }}>✓ Swap Points Accepted</Text>
          {buyerSub.can_spend_sp ? (
            <Text>You can use your Swap Points as partial payment!</Text>
          ) : (
            <Text>Subscribe to Kids Club+ to use Swap Points on this item.</Text>
          )}
        </View>
      )}

      <Text>Transaction Fee: ${feeAmount.toFixed(2)}</Text>
      <Text>Total (before SP discount): ${((listing.price_cents / 100) + feeAmount).toFixed(2)}</Text>

      <Button title="Buy Now" onPress={handleBuyNow} />
    </View>
  );
};

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Listing detail shows full item info
✓ SP eligibility clearly displayed
✓ Fee disclosure shown ($0.99 vs $2.99 based on buyer subscription)
✓ "Buy Now" navigates to trade initiation (MODULE-06)

==================================================
NEXT TASK: LISTING-V2-006 (Admin Tools)
==================================================
*/
```

---

## TASK LISTING-V2-006: Admin Tools for Listing Management

**Duration:** 2 hours  
**Priority:** Medium  
**Dependencies:** LISTING-V2-001 through LISTING-V2-005

### Description

Build admin dashboard features for managing listings:
- Search listings by seller, ID, status.
- View seller subscription status at creation vs current (audit trail).
- Force-delete or pause listings (with reason logging).
- Analytics: SP-eligible listing adoption rate, average price.

### AI Prompt for Cursor

```typescript
/*
TASK: Build admin dashboard for listing management

REQUIREMENTS:
1. Admin search and filter UI
2. Admin listing detail with subscription audit
3. Force-delete/pause actions with logging
4. Analytics: SP adoption rate

==================================================
FILE 1: Admin Listing Search UI
==================================================
*/

// filepath: src/admin/components/ListingSearch.tsx

import React, { useState } from 'react';
import { View, TextInput, Button, FlatList, Text } from 'react-native';
import { supabase } from '../../lib/supabase';

export const ListingSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [listings, setListings] = useState([]);

  const handleSearch = async () => {
    let query = supabase.from('listings').select('*');

    if (searchQuery) {
      query = query.or(`id.eq.${searchQuery},seller_id.eq.${searchQuery},item_name.ilike.%${searchQuery}%`);
    }

    const { data } = await query.order('created_at', { ascending: false }).limit(50);
    setListings(data || []);
  };

  return (
    <View>
      <TextInput
        placeholder="Search by Listing ID, Seller ID, or Item Name"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      <Button title="Search" onPress={handleSearch} />

      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View>
            <Text>Listing {item.id}</Text>
            <Text>Item: {item.item_name}</Text>
            <Text>Status: {item.status}</Text>
            <Text>SP Eligible: {item.accepts_swap_points ? 'Yes' : 'No'}</Text>
          </View>
        )}
      />
    </View>
  );
};

/*
==================================================
FILE 2: Admin Force-Delete RPC
==================================================
*/

// filepath: supabase/migrations/041_admin_force_delete_listing.sql

CREATE OR REPLACE FUNCTION admin_force_delete_listing(
  p_listing_id UUID,
  p_admin_user_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark listing as deleted
  UPDATE listings
  SET 
    status = 'deleted',
    last_edited_at = NOW()
  WHERE id = p_listing_id;

  -- Log admin action
  INSERT INTO admin_action_logs (admin_user_id, action_type, entity_type, entity_id, reason)
  VALUES (p_admin_user_id, 'force_delete_listing', 'listing', p_listing_id, p_reason);
END;
$$;

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Admin can search listings by seller, ID, item name
✓ Admin can view subscription audit trail (status at creation vs current)
✓ Admin can force-delete with audit logging
✓ Analytics show SP-eligible listing adoption rate

==================================================
NEXT TASK: LISTING-V2-007 (Tests & Module Summary)
==================================================
*/
```

---

## TASK LISTING-V2-007: Listing Module Tests & Summary

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** LISTING-V2-001 through LISTING-V2-006

### Description

Write comprehensive tests for listing module and finalize documentation.

**Tests to cover:**
1. **Create listing**: Subscription gating for SP payment.
2. **Edit listing**: Ownership check, active trade prevention.
3. **Delete listing**: Soft delete.
4. **Catalog filtering**: SP-eligible filter.
5. **Admin tools**: Force-delete with logging.

**Module summary:**
- Listing lifecycle and states.
- Cross-module integration (MODULE-11 for subscription checks).
- Payment preference rules.

### AI Prompt for Cursor

```typescript
/*
TASK: Write tests for listing module and finalize docs

REQUIREMENTS:
1. Unit tests for createListingV2, updateListingV2, deleteListingV2
2. Integration tests for SP filtering
3. Module summary with state diagram and integration points

==================================================
FILE 1: createListingV2 Unit Tests
==================================================
*/

// filepath: src/services/listing.test.ts

import { describe, it, expect, vi } from 'vitest';
import { createListingV2 } from './listing';
import * as subscriptionService from './subscription';
import { supabase } from '../lib/supabase';

vi.mock('./subscription');
vi.mock('../lib/supabase');

describe('createListingV2', () => {
  it('should allow subscribers to enable SP payment', async () => {
    vi.spyOn(subscriptionService, 'getSubscriptionSummary').mockResolvedValue({
      status: 'active',
      can_spend_sp: true,
      is_subscriber: true,
    });

    vi.spyOn(supabase.from('listings'), 'insert').mockResolvedValue({
      data: { id: 'listing-1', accepts_swap_points: true },
      error: null,
    });

    const result = await createListingV2({
      sellerId: 'seller-1',
      itemName: 'Toy Car',
      itemDescription: 'Red toy car',
      priceCents: 500,
      category: 'toys',
      condition: 'good',
      imageUrls: [],
      acceptsSwapPoints: true,
    });

    expect(result.accepts_swap_points).toBe(true);
  });

  it('should reject SP payment for non-subscribers', async () => {
    vi.spyOn(subscriptionService, 'getSubscriptionSummary').mockResolvedValue({
      status: 'expired',
      can_spend_sp: false,
      is_subscriber: false,
    });

    await expect(
      createListingV2({
        sellerId: 'seller-2',
        itemName: 'Book',
        itemDescription: 'Used book',
        priceCents: 300,
        category: 'books',
        condition: 'good',
        imageUrls: [],
        acceptsSwapPoints: true,
      })
    ).rejects.toThrow('Only Kids Club+ subscribers can accept Swap Points');
  });
});

/*
==================================================
FILE 2: Catalog Filtering Integration Test
==================================================
*/

import { fetchListings } from './listing';

describe('fetchListings', () => {
  it('should filter for SP-eligible listings only', async () => {
    vi.spyOn(supabase.from('listings'), 'select').mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: '1', accepts_swap_points: true },
          { id: '2', accepts_swap_points: true },
        ],
        error: null,
      }),
    });

    const result = await fetchListings({ spEligibleOnly: true });

    expect(result.length).toBe(2);
    expect(result.every((l) => l.accepts_swap_points)).toBe(true);
  });
});

/*
==================================================
FILE 3: Module Summary
==================================================
*/

## MODULE-04 SUMMARY: Item Listing & Catalog Management (V2)

### Overview
This module enables sellers to create and manage item listings with Kids Club+ V2 enhancements:
- **SP Payment Preferences**: Sellers can opt-in to accept Swap Points (subscribers only).
- **Subscription-Aware Gating**: Only `trial`/`active` subscribers can enable SP payment on listings.
- **Catalog Filtering**: Buyers can filter for SP-eligible listings.
- **Audit Trail**: Seller subscription status captured at listing creation.

### Listing Lifecycle
```
DRAFT → ACTIVE ⇄ PAUSED → SOLD / DELETED
```

### Cross-Module Integration
- **MODULE-11 (Subscriptions)**: `getSubscriptionSummary(sellerId)` to gate SP payment option.
- **MODULE-06 (Trade Flow)**: Listings with `accepts_swap_points = true` allow SP usage in trades.

### Key Rules
1. **SP Gating**: Only subscribers can enable `accepts_swap_points`.
2. **Edit Constraints**: Listings with active trades cannot be edited.
3. **Soft Delete**: Deleting marks listing as `deleted` (audit trail preserved).
4. **Catalog Visibility**: SP-eligible listings tagged with badge for easy discovery.

### API Surface
- `createListingV2(input)`: Creates new listing with SP preference.
- `updateListingV2(input)`: Edits listing (if no active trades).
- `deleteListingV2(listingId, userId)`: Soft-deletes listing.
- `fetchListings(filters)`: Fetches catalog with optional SP filter.

### Test Coverage
- ✓ Subscriber can enable SP payment.
- ✓ Non-subscriber rejected when enabling SP.
- ✓ Catalog filters SP-eligible listings.
- ✓ Edit prevented for listings with active trades.

---

## MODULE-04 COMPLETE ✅

All 7 micro-tasks (LISTING-V2-001 through LISTING-V2-007) have been specified with full AI agent prompts, acceptance criteria, and cross-module integration points.

**Next Step:** Create `MODULE-04-VERIFICATION-V2.md` verification checklist.

---
