-- filepath: supabase/migrations/20251216_create_geographic_nodes_table.sql
-- Create geographic_nodes table for node management (NODE-001)
-- NOTE: This migration now includes role_based_access_control table creation

-- First, create role_based_access_control table if it doesn't exist
-- This is used for RLS policies on geographic_nodes
CREATE TABLE IF NOT EXISTS role_based_access_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT role_based_access_control_user_id_role_unique UNIQUE(user_id, role)
);

-- Create index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_role_based_access_control_user_id 
  ON role_based_access_control(user_id);
CREATE INDEX IF NOT EXISTS idx_role_based_access_control_role 
  ON role_based_access_control(role);

-- Enable RLS on role_based_access_control
-- NOTE: RLS will be added later via app layer, not via policies (to avoid infinite recursion)
-- ALTER TABLE role_based_access_control ENABLE ROW LEVEL SECURITY;

-- NOTE: Policies on role_based_access_control removed due to recursion issue
-- Access control for roles is managed at the application layer instead

-- Now create geographic_nodes table
CREATE TABLE IF NOT EXISTS geographic_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  zip_code VARCHAR(5) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_miles INTEGER NOT NULL DEFAULT 10,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  member_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT geographic_nodes_zip_code_unique UNIQUE(zip_code)
);

-- Create indexes for geographic queries
CREATE INDEX IF NOT EXISTS idx_geographic_nodes_is_active ON geographic_nodes(is_active);
CREATE INDEX IF NOT EXISTS idx_geographic_nodes_zip_code ON geographic_nodes(zip_code);
CREATE INDEX IF NOT EXISTS idx_geographic_nodes_created_at ON geographic_nodes(created_at);

-- Enable RLS on geographic_nodes table
ALTER TABLE geographic_nodes ENABLE ROW LEVEL SECURITY;

-- RLS policy: Allow admins to read/write geographic nodes
DROP POLICY IF EXISTS "Admin can manage geographic nodes" ON geographic_nodes;
CREATE POLICY "Admin can manage geographic nodes" ON geographic_nodes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM role_based_access_control
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- RLS policy: Allow public to read active nodes
DROP POLICY IF EXISTS "Public can read active nodes" ON geographic_nodes;
CREATE POLICY "Public can read active nodes" ON geographic_nodes
  FOR SELECT
  USING (is_active = true);

-- Create audit log entries for geographic_nodes (if not exists)
-- Used in NODE-001 and NODE-002 for admin action logging
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  changes JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on audit log for performance
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity_type ON admin_audit_log(entity_type);
