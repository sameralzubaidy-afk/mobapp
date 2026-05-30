# JSONB Casting - SQL Pattern Reference

## Problem: PostgreSQL Error 22023
```
ERROR: cannot cast jsonb string to type boolean
ERROR: cannot cast jsonb string to type integer
```

This occurs when trying to cast JSONB directly to scalar types.

---

## Solution Pattern

### Pattern: JSONB → TEXT → SCALAR TYPE

```sql
-- WRONG (Direct cast - fails)
config_value::INTEGER
config_value::BOOLEAN
config_value::NUMERIC

-- RIGHT (Extract to text, then cast)
(config_value #>> '{}')::INTEGER
(config_value #>> '{}')::BOOLEAN
(config_value #>> '{}')::NUMERIC
(config_value #>> '{}')::TEXT
```

---

## Common Use Cases

### Case 1: Get INTEGER from JSONB
```sql
-- Get SP amount from config (default to 10 if missing)
SELECT COALESCE((config_value #>> '{}')::INTEGER, 10)
FROM sp_config
WHERE config_key = 'referral_reward_referee_sp';
```

### Case 2: Get BOOLEAN from JSONB
```sql
-- Get feature toggle from config (default to true if missing)
SELECT COALESCE((config_value #>> '{}')::BOOLEAN, true)
FROM sp_config
WHERE config_key = 'referral_first_listing_enabled';
```

### Case 3: Get TEXT from JSONB
```sql
-- Get text config value
SELECT config_value #>> '{}'
FROM sp_config
WHERE config_key = 'some_text_config';
```

### Case 4: In PL/pgSQL Function
```sql
CREATE OR REPLACE FUNCTION get_sp_config_int(p_key TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_value INTEGER := 0;
BEGIN
    -- CORRECT: Extract text first, then cast to INTEGER
    SELECT COALESCE((config_value #>> '{}')::INTEGER, 0) INTO v_value
    FROM sp_config
    WHERE config_key = p_key;
    
    RETURN v_value;
END;
$$ LANGUAGE plpgsql;
```

### Case 5: In WHERE Clause
```sql
-- Wrong: won't work
WHERE (config_value::BOOLEAN) IS TRUE

-- Right: extract first
WHERE (config_value #>> '{}')::BOOLEAN IS TRUE
```

---

## Storing JSONB Values

### Pattern: Cast Scalars TO JSONB When Inserting

```sql
-- Insert INTEGER as JSONB
INSERT INTO sp_config (config_key, config_value, value_type)
VALUES ('count', (42)::jsonb, 'number');

-- Insert BOOLEAN as JSONB
INSERT INTO sp_config (config_key, config_value, value_type)
VALUES ('enabled', (true)::jsonb, 'boolean');

-- Insert TEXT as JSONB
INSERT INTO sp_config (config_key, config_value, value_type)
VALUES ('name', ('"MyString"'::jsonb), 'text');
-- Note: must quote strings in JSONB, so use '"string"'::jsonb
```

---

## The #>> Operator Explained

```
jsonb_column #>> '{}' 
  ↓
  Extracts the text representation of the JSONB value
  ↓
  Returns: TEXT type (which can then be cast)
```

### Examples:
```sql
SELECT '123'::jsonb #>> '{}';           -- Returns: '123' (text)
SELECT 'true'::jsonb #>> '{}';          -- Returns: 'true' (text)
SELECT '"hello"'::jsonb #>> '{}';       -- Returns: 'hello' (text)
SELECT '[1,2,3]'::jsonb #>> '{}';       -- Returns: '[1,2,3]' (text)

-- Then cast the text result
SELECT ('123'::jsonb #>> '{}')::INTEGER;    -- 123 (integer)
SELECT ('true'::jsonb #>> '{}')::BOOLEAN;   -- true (boolean)
```

---

## Related JSONB Operators

| Operator | Returns | Example | Result |
|----------|---------|---------|--------|
| `#>>'{}'` | TEXT | `'123'::jsonb #>>'{}'` | `'123'` |
| `#>'{}'` | JSONB | `'123'::jsonb #>'{}'` | `123` (JSONB) |
| `->'key'` | JSONB | `'{"a":1}'::jsonb -> 'a'` | `1` (JSONB) |
| `->>key'` | TEXT | `'{"a":1}'::jsonb ->> 'a'` | `'1'` (TEXT) |

---

## Testing JSONB Casting

```sql
-- Test 1: Direct cast fails
SELECT 'true'::jsonb::BOOLEAN;
-- ERROR: cannot cast type jsonb to boolean

-- Test 2: Extract-then-cast works
SELECT ('true'::jsonb #>> '{}')::BOOLEAN;
-- Result: true

-- Test 3: With COALESCE and default
SELECT COALESCE(('null'::jsonb #>> '{}')::BOOLEAN, false);
-- Result: false (since null string becomes NULL after extraction)

-- Test 4: With actual sp_config table
SELECT COALESCE((config_value #>> '{}')::INTEGER, 0)
FROM sp_config
WHERE config_key = 'referral_reward_referee_sp';
-- Result: 10 (or default 0)
```

---

## Summary: 3-Step Rule

1. **Extract** JSONB to TEXT using `#>>'{}'`
2. **Cast** TEXT to desired type using `::TYPE`
3. **Handle** NULL values with `COALESCE(..., default_value)`

```sql
-- Template
SELECT COALESCE((jsonb_column #>> '{}')::DESIRED_TYPE, default_value)
FROM table_name
WHERE condition;
```

---

## Files to Reference

For production code:
- `supabase/migrations/20260205000003_ultimate_test_alignment_fix.sql` (Fixed functions)
- `supabase/migrations/20260205000004_seed_referral_feature_toggles.sql` (Correct seeding)

