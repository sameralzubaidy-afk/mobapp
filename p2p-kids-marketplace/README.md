## Sentry Release Uploads

To upload source maps and create a Sentry release during CI/EAS, add these secrets to your repo settings:
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG` (Sentry organization slug)
- `SENTRY_PROJECT_MOBILE` (Sentry project slug for mobile)
Set the `RELEASE` environment variable during CI (`RELEASE=${{ github.sha }}`) and the workflow `sentry-release.yml` will create and upload the release automatically.

### Local EAS Dev Client Build (for native Sentry captures)
To build a dev client with the native Sentry SDK included, run:

```bash
# Requires EXPO_TOKEN set as environment or CI secret
cd p2p-kids-marketplace
npm run eas:build:dev
```

After install, install the built dev client on your simulator or device and run the app. Trigger the Debug screen to send native Sentry events.

### Local release upload
To create and upload a release locally (requires SENTRY_AUTH_TOKEN and SENTRY_ORG/PROJECT):
```bash
cd p2p-kids-marketplace
RELEASE=$(git rev-parse --short HEAD) npm run sentry:release
```

### Helper scripts
We added two scripts to simplify the workflow:
- `scripts/set-release.sh [<release>]` — set `EXPO_PUBLIC_RELEASE` in `.env.local` (defaults to git short sha)
- `scripts/dev-sentry-flow.sh` — trigger an EAS dev build (dev client) and print Sentry release upload steps. Requires `EXPO_TOKEN` and `SENTRY_AUTH_TOKEN` environment variables.

Usage examples:
```bash
cd p2p-kids-marketplace
./scripts/set-release.sh # sets EXPO_PUBLIC_RELEASE to git short sha
export EXPO_TOKEN="<your-expo-token>"
export SENTRY_AUTH_TOKEN="<your-sentry-auth-token>"
./scripts/dev-sentry-flow.sh
```


### Add Sentry secrets to GitHub or EAS

Set the following secrets in your GitHub repo or EAS secrets:
- `SENTRY_AUTH_TOKEN` (from Sentry: Organization -> API Keys)
- `SENTRY_ORG` (Sentry organization slug)
- `SENTRY_PROJECT_MOBILE` (project slug id)
- `EXPO_TOKEN` (Expo EAS token if using EAS builds)



# P2P Kids Marketplace — Mobile

Local dev

1. Copy `.env.local.example` → `.env.local` and set your Supabase keys
2. Install dependencies:

```bash
cd p2p-kids-marketplace
npm install
```

3. Run dev server:

```bash
npm run start
```

Sentry
------

The mobile app uses Sentry for error tracking. To enable Sentry locally, add the following to your `.env.local` file:

```bash
EXPO_PUBLIC_SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/yyyyy
EXPO_PUBLIC_ENVIRONMENT=development
```

Note: Do NOT commit secrets into git. The `sentry.properties` file exists as a template and includes placeholders for `auth.token`.
