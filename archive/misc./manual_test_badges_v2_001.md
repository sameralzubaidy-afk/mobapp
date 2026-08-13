# Manual Test Cases: MODULE-08 BADGES-V2-001 (Schema & Types)

## Overview
These test cases verify the database schema setup and initial seeding for the Badges module.

## Prerequisites
- Supabase project access.
- SQL Migration `20260110000000_badges_v2.sql` applied to the database.

## Test Case 1: Verify Table Structure
**Step 1:** Open Supabase SQL Editor or Table Editor.
**Step 2:** Verify that `badges` table exists with columns:
  - `id` (uuid)
  - `name` (text, unique)
  - `description` (text)
  - `category` (text)
  - `icon_url` (text)
  - `threshold` (int)
  - `is_active` (boolean)
  - `sort_order` (int)
  - `created_at` (timestamptz)
**Step 3:** Verify that `user_badges` table exists with columns:
  - `id` (uuid)
  - `user_id` (uuid, fkey to users.id)
  - `badge_id` (uuid, fkey to badges.id)
  - `awarded_at` (timestamptz)

**Expected Result:** Both tables exist with correct schema and relationships.

## Test Case 2: Verify Seed Data
**Step 1:** Run query `SELECT count(*) FROM badges;`.
**Step 2:** Run query `SELECT name, category, threshold FROM badges ORDER BY category, threshold;`.

**Expected Result:**
- Count should be at least 13.
- All 13 badges from the spec should be present (SP Earner Bronze/Silver/Gold/Platinum, SP Spender Bronze/Silver, First Trade, 10/50 Trades, etc.).

## Test Case 3: Verify Unique Constraint
**Step 1:** Identify a user ID and a badge ID.
**Step 2:** Try to insert the same `(user_id, badge_id)` pair into `user_badges` twice manually.

**Expected Result:** The second insert fails with a unique constraint violation on `user_id, badge_id`.

## Test Case 4: Verify RLS Policies
**Step 1:** Query `badges` as an unauthenticated user (if possible, or via API anon key).
**Step 2:** Query `user_badges` for a user ID that is NOT your current auth user.

**Expected Result:**
- `badges` should be readable by everyone.
- `user_badges` should be readable by everyone (per spec for profile display) OR restricted if changed, but for now policy allows it. (Note: Policy created was `Anyone can view user awarded badges`).

## Test Case 5: TypeScript Compilation
**Step 1:** Run `npm run type-check`.

**Expected Result:** No errors related to `src/types/badge.ts` or imports of `Badge` / `UserBadge` types.
