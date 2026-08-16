-- PRODUCTION SETUP: admin_config (Step-by-Step Version)
-- Run each section separately if you get errors

-- ========================================
-- STEP 1: Drop existing objects
-- ========================================
DROP TABLE IF EXISTS admin_config CASCADE;
DROP TYPE IF EXISTS admin_config_category CASCADE;
