# Authentication Flow Comparison

## BEFORE (Broken - HTTP 400 Errors)

```
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Step 1: Admin logs in                                       │
│  ProtectedLayout.tsx:                                        │
│  ├─ Creates supabase client (anon key)                       │
│  ├─ Calls supabase.auth.getUser()                            │
│  ├─ Supabase Auth verifies credentials                       │
│  ├─ Returns session with JWT token                           │
│  └─ Session saved to localStorage ✅                         │
│                                                              │
│  Step 2: Open Manual Award Modal                            │
│  ManualAwardModal.tsx:                                       │
│  ├─ Creates NEW supabase client (module-level const) ❌     │
│  ├─ This new client does NOT read localStorage              │
│  ├─ No JWT token in Authorization header                    │
│  └─ Request sent: /rest/v1/profiles?email=eq...             │
│                                                              │
│  Step 3: Supabase receives request                           │
│  PostgREST API:                                              │
│  ├─ No Authorization header found ❌                         │
│  ├─ No JWT token to validate                                │
│  ├─ Request rejected: HTTP 400 Bad Request                  │
│  └─ Client sees: "User not found" ❌                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## AFTER (Fixed - HTTP 200 Success)

```
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Step 1: Admin logs in (same as before)                      │
│  ProtectedLayout.tsx:                                        │
│  ├─ Creates supabase client (anon key)                       │
│  ├─ Calls supabase.auth.getUser()                            │
│  ├─ Supabase Auth verifies credentials                       │
│  ├─ Returns session with JWT token                           │
│  └─ Session saved to localStorage ✅                         │
│                                                              │
│  Step 2: Open Manual Award Modal (NOW FIXED)                │
│  ManualAwardModal.tsx:                                       │
│  ├─ Calls createAuthenticatedClient() ✅                    │
│  ├─ Function creates NEW supabase client                     │
│  ├─ New client reads JWT from localStorage ✅               │
│  ├─ JWT token included in Authorization header ✅            │
│  └─ Request sent with:                                       │
│      Authorization: Bearer <JWT_TOKEN>                      │
│                                                              │
│  Step 3: Supabase receives request                           │
│  PostgREST API:                                              │
│  ├─ Authorization header found ✅                           │
│  ├─ JWT token validated                                     │
│  ├─ User context extracted from JWT                         │
│  ├─ RLS policies evaluated with user context                │
│  ├─ Profile record found and returned                       │
│  └─ HTTP 200 OK with user data ✅                           │
│                                                              │
│  Step 4: ManualAwardModal displays result                    │
│  Browser:                                                    │
│  ├─ User card renders with name and email ✅               │
│  ├─ Badge selection dropdown appears ✅                     │
│  └─ Admin can proceed with badge award ✅                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Code Change Comparison

### BEFORE: Module-Level Singleton (BROKEN)
```typescript
// ManualAwardModal.tsx
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function ManualAwardModal({ ... }) {
  const handleSearchUser = async () => {
    // This supabase client has NO JWT token!
    const { data } = await supabase
      .from('profiles')
      .select('...')
      .eq('email', searchEmail);
    // ❌ HTTP 400 - unauthorized
  };
}
```

### AFTER: Function-Based Factory (FIXED)
```typescript
// ManualAwardModal.tsx
function createAuthenticatedClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function ManualAwardModal({ ... }) {
  const handleSearchUser = async () => {
    // This new client reads JWT from localStorage
    const supabase = createAuthenticatedClient();
    
    // Verify we have a valid session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSearchError('Authentication required...');
      return;
    }
    
    // ✅ HTTP 200 - request includes Authorization header
    const { data } = await supabase
      .from('profiles')
      .select('...')
      .eq('email', searchEmail);
  };
}
```

## Key Difference: localStorage Session Handling

### The Critical Missing Piece (BEFORE)
```typescript
// When a Supabase client is created with anon key,
// it should automatically read the session from localStorage...
// BUT if you create a static const at module level,
// and the session wasn't yet in localStorage when the module loaded,
// the client never picks it up!

const supabase = createClient(...);  // ❌ Evaluates at import time
                                      // ❌ Session not in localStorage yet
                                      // ❌ No JWT in future requests
```

### The Fix (AFTER)
```typescript
// By creating a fresh client on-demand,
// we GUARANTEE it reads the current session state from localStorage

function createAuthenticatedClient() {
  return createClient(...);  // ✅ Evaluates at runtime
                            // ✅ Session already in localStorage
                            // ✅ JWT automatically included
}
```

## RLS Policy Relevance

The profiles table has a simple RLS policy:
```sql
CREATE POLICY "Public profiles are viewable"
  ON profiles FOR SELECT
  USING (true);  -- Allows anyone to view
```

However:
- ❌ **BEFORE**: No JWT in request → PostgREST rejects at API gateway → 400 error (never reaches RLS)
- ✅ **AFTER**: JWT in request → PostgREST validates token → RLS policy allows read → 200 success

The RLS policy was NEVER the problem - it was the authorization header missing!

---

## Takeaway

**Module-level Supabase clients in React components can miss the JWT token if created before authentication completes.**

**Solution: Create fresh client instances on-demand using a factory function. Supabase Auth automatically stores the JWT in localStorage, and each new client instance will pick it up.**
