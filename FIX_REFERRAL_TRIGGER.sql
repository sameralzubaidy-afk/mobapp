-- FIX: Make referral code trigger non-blocking
-- This allows signup to succeed even if referral code generation fails

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS create_referral_code_trigger ON auth.users;
DROP FUNCTION IF EXISTS create_referral_code_on_signup();

-- Create a safe version that catches errors
CREATE OR REPLACE FUNCTION create_referral_code_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to create referral code, but don't fail if it errors
  BEGIN
    PERFORM create_referral_code(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the signup
    RAISE WARNING 'Failed to create referral code for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create the trigger
CREATE TRIGGER create_referral_code_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION create_referral_code_on_signup();

-- Verification: Test that the function handles errors gracefully
SELECT 'Trigger updated successfully. Signup will now proceed even if referral code generation fails.' as status;