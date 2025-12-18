-- Supabase migration: Seed initial geographic nodes
-- Purpose: Create Norwalk CT and Little Falls NJ nodes for NODE-005
-- Date: 2025-12-17

-- Insert Norwalk, CT node (with proper UUID)
INSERT INTO nodes (
  id,
  name,
  city,
  state,
  zip_code,
  latitude,
  longitude,
  radius_miles,
  description,
  is_active,
  member_count,
  created_at,
  updated_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'Norwalk Central',
  'Norwalk',
  'CT',
  '06850',
  41.1177,
  -73.4079,
  10,
  'Norwalk, Connecticut - Kids marketplace for trading items within the Norwalk community',
  true,
  0,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert Little Falls, NJ node (with proper UUID)
INSERT INTO nodes (
  id,
  name,
  city,
  state,
  zip_code,
  latitude,
  longitude,
  radius_miles,
  description,
  is_active,
  member_count,
  created_at,
  updated_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440002'::uuid,
  'Little Falls Central',
  'Little Falls',
  'NJ',
  '07424',
  40.8452,
  -74.2171,
  10,
  'Little Falls, New Jersey - Kids marketplace for trading items within the Little Falls community',
  true,
  0,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Verify nodes were created
SELECT id, name, city, state, is_active FROM nodes 
WHERE id IN ('550e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440002'::uuid);
