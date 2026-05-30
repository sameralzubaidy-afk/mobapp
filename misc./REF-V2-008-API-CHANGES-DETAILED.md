# API Changes Summary - sp-config Endpoint

## The Problem

### Error 1: 404 on Page Load
```
GET /api/admin/sp-config?key=referral_first_trade_enabled
Response: 404 Not Found
Message: Cannot coerce the result to a single JSON object
```

**Why**: The endpoint uses `.single()` which requires exactly 1 row. If 0 rows exist, it throws.

### Error 2: 500 on Toggle Save
```
PATCH /api/admin/sp-config
Body: { key: "referral_first_trade_enabled", value: "false" }
Response: 500 Internal Server Error
Message: Cannot coerce the result to a single JSON object
```

**Why**: The endpoint tries to UPDATE a row that doesn't exist (0 rows affected), then calls `.single()` on 0 rows.

---

## The Solution: Upsert Logic

### Before (Broken)
```typescript
// Only tries to UPDATE - fails if key doesn't exist
const { data, error } = await adminClient
  .from('sp_config')
  .update({ 
    config_value: value,
    updated_at: new Date().toISOString(),
  })
  .eq('config_key', key)
  .select()
  .single();  // ❌ FAILS: throws if 0 rows

if (error) {
  return NextResponse.json({ error: error.message }, { status: 500 });
}
```

### After (Fixed)
```typescript
// Step 1: Try UPDATE
const { data: updateData, error: updateError } = await adminClient
  .from('sp_config')
  .update({ 
    config_value: value,
    updated_at: new Date().toISOString(),
  })
  .eq('config_key', key)
  .select();  // ✅ No .single() - returns array

// Step 2: Check if UPDATE succeeded
if (updateData && updateData.length > 0) {
  console.log(`✅ Updated ${key} = ${value}`);
  return NextResponse.json({ success: true, data: updateData[0] });
}

// Step 3: If UPDATE returned 0 rows, INSERT instead
if (!updateError || updateData?.length === 0) {
  const { data: insertData, error: insertError } = await adminClient
    .from('sp_config')
    .insert([
      {
        config_key: key,
        config_value: value,
        value_type: 'boolean',
        description: `Auto-created: ${key}`,
        category: 'referral',
      },
    ])
    .select()
    .single();  // ✅ OK: will have 1 row from INSERT

  if (insertError) {
    console.error('Insert error:', insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  console.log(`✅ Inserted new config ${key} = ${value}`);
  return NextResponse.json({ success: true, data: insertData });
}

// Step 4: Handle any other errors
if (updateError) {
  console.error('Update error:', updateError);
  return NextResponse.json({ error: updateError.message }, { status: 500 });
}
```

---

## Key Changes

### 1. Removed `.single()` from UPDATE
```diff
- .select().single();
+ .select();
```
**Why**: UPDATE might return 0 rows (if key doesn't exist), and `.single()` fails on 0 rows.

### 2. Check if UPDATE succeeded
```typescript
if (updateData && updateData.length > 0) {
  return NextResponse.json({ success: true, data: updateData[0] });
}
```
**Why**: Know if rows were actually updated before proceeding.

### 3. Add INSERT fallback
```typescript
if (!updateError || updateData?.length === 0) {
  // INSERT logic here
}
```
**Why**: If UPDATE found 0 rows, create the key instead of failing.

### 4. Return array element for UPDATE
```typescript
// UPDATE returns array
return NextResponse.json({ success: true, data: updateData[0] });

// INSERT returns single object from .single()
return NextResponse.json({ success: true, data: insertData });
```
**Why**: Consistent response format either way.

---

## Request/Response Examples

### Scenario 1: Key Exists → UPDATE

**Request**:
```
PATCH /api/admin/sp-config
x-admin-secret: your_secret_123
Body: { key: "referral_first_trade_enabled", value: "false" }
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid-123",
    "config_key": "referral_first_trade_enabled",
    "config_value": "false",
    "updated_at": "2025-02-05T12:34:56Z"
  }
}
```

**Logs**:
```
[sp-config API] ✅ Updated referral_first_trade_enabled = false
```

---

### Scenario 2: Key Doesn't Exist → INSERT

**Request**:
```
PATCH /api/admin/sp-config
x-admin-secret: your_secret_123
Body: { key: "referral_first_trade_enabled", value: "true" }
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid-456",
    "config_key": "referral_first_trade_enabled",
    "config_value": "true",
    "value_type": "boolean",
    "description": "Auto-created: referral_first_trade_enabled",
    "category": "referral",
    "created_at": "2025-02-05T12:34:56Z",
    "updated_at": "2025-02-05T12:34:56Z"
  }
}
```

**Logs**:
```
[sp-config API] ✅ Created new config referral_first_trade_enabled = true
```

---

### Scenario 3: Missing Admin Secret

**Request**:
```
PATCH /api/admin/sp-config
Body: { key: "referral_first_trade_enabled", value: "false" }
(no x-admin-secret header)
```

**Response** (401 Unauthorized):
```json
{
  "error": "Unauthorized: Invalid admin secret"
}
```

---

### Scenario 4: Missing Required Fields

**Request**:
```
PATCH /api/admin/sp-config
x-admin-secret: your_secret_123
Body: { key: "referral_first_trade_enabled" }
(missing "value" field)
```

**Response** (400 Bad Request):
```json
{
  "error": "Missing required fields: key, value"
}
```

---

## How Services Consume This

### Old Service Code (With Try-Catch)
```typescript
static async update(key: string, value: string, adminSecret: string): Promise<void> {
  try {
    const res = await fetch('/api/admin/sp-config', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret,
      },
      body: JSON.stringify({ key, value }),
    });

    if (!res.ok) {
      throw new Error('Failed to update config');
    }
  } catch (err) {
    throw err;
  }
}
```

### New Service Code (Graceful Fallback)
```typescript
static async update(key: string, value: string, adminSecret: string): Promise<void> {
  try {
    const res = await fetch('/api/admin/sp-config', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret,
      },
      body: JSON.stringify({ key, value }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to update config' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
  } catch (err) {
    // Log but don't throw - graceful degradation
    console.error('[SPConfigService] Update failed:', err.message);
    throw err; // Actually we do throw for UI to handle
  }
}
```

---

## Testing the API Directly

### Using cURL

**Test UPDATE (key exists)**:
```bash
curl -X PATCH http://localhost:3001/api/admin/sp-config \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: your_secret_123" \
  -d '{"key":"referral_first_trade_enabled","value":"false"}'
```

**Test INSERT (new key)**:
```bash
curl -X PATCH http://localhost:3001/api/admin/sp-config \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: your_secret_123" \
  -d '{"key":"new_config_key","value":"true"}'
```

**Test GET**:
```bash
curl "http://localhost:3001/api/admin/sp-config?key=referral_first_trade_enabled"
```

---

## Database Impact

### Before Fix
- First toggle click: 500 error, config key not created
- Second toggle click: same 500 error
- User confusion: toggle doesn't work

### After Fix
- First toggle click: 200 OK, config key auto-created, value saved
- Second toggle click: 200 OK, config key updated
- User experience: smooth, no errors

---

## Migration Safety

The new migration is **idempotent** and **safe to re-run**:

```sql
INSERT INTO sp_config (config_key, config_value, value_type, description, category)
VALUES
  ('referral_first_trade_enabled', 'true', 'boolean', 'Enable SP bonus on first referee trade', 'referral'),
  ('referral_first_listing_enabled', 'true', 'boolean', 'Enable SP bonus on first referee listing', 'referral')
ON CONFLICT (config_key) DO NOTHING;
```

- ✅ First run: inserts 2 rows
- ✅ Second run: inserts 0 rows (already exist)
- ✅ Safe to run on all environments (dev, staging, prod)

---

## Summary

**What Changed**: API endpoint for config updates now supports auto-create on first save.

**How It Works**:
1. User toggles switch in admin UI
2. Frontend sends PATCH with key and value
3. API tries UPDATE
4. If key exists: UPDATE succeeds, returns updated row
5. If key doesn't exist: INSERT creates it with defaults, returns new row
6. Either way: success response, no errors

**Result**: Referral configuration page works smoothly without errors.

