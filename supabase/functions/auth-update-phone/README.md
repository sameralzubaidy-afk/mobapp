# auth-update-phone

Edge Function to update a user's phone number using the Supabase service role key (admin privileges). This avoids relying on an SMS provider when updating the phone programmatically (useful during verification flows).

Environment variables required:

- `SUPABASE_URL` - your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - service_role key with admin privileges

Usage (client):

```ts
await supabase.functions.invoke('auth-update-phone', {
  body: { user_id: '<user-uuid>', phone: '+15555551234' }
});
```

Deploy with `supabase` CLI or push via your CI/CD pipeline. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in the function's environment in the Supabase dashboard.

Quick deploy (local):

```bash
# Login to supabase
npx supabase login

# Deploy function
npx supabase functions deploy auth-update-phone --project-ref <your-project-ref>

# Set service role secret for the function (or set in dashboard)
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>" --project-ref <your-project-ref>
```

Notes:
- After deploying, test by calling the function from the app (it will be invoked automatically during phone verification) or invoke directly via the Supabase dashboard or CLI.
- Keep the service role key secret. Only grant access to CI or secrets manager.
