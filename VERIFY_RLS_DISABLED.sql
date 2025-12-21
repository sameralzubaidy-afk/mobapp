-- CORRECTED SQL - Verify RLS is disabled on admin_config

-- This part was successful:
ALTER TABLE admin_config DISABLE ROW LEVEL SECURITY;

-- CORRECTED verification query (use pg_tables instead):
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'admin_config';

-- Alternative query that also works:
SELECT relname as tablename, relrowsecurity as rowsecurity 
FROM pg_class 
WHERE relname = 'admin_config';
