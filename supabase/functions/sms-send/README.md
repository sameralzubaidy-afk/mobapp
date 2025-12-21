Supabase Edge Function `sms-send`

This simple Edge Function proxies SMS send requests to an AWS Lambda/API Gateway endpoint.

Configuration (set these as secrets in Supabase project):
- `AWS_SNS_API_GATEWAY_URL`: The base URL of your API Gateway that calls the SMS Lambda
- `AWS_SNS_API_GATEWAY_KEY`: (optional) API key for the gateway

Usage:
- Client app posts to this Edge Function endpoint (URL is region based) with body: `{ phoneNumber, message }`
- The edge function forwards the message to your API Gateway. Rate limiting and SNS credentials should be enforced in the Lambda behind the API Gateway (or this function if you prefer).

Security:
- Protect the API via API key or JWT. Don't expose unprotected SMS endpoints publicly.

Deployment:
- Deploy with `supabase functions deploy sms-send --project-ref <PROJECT_REF>`
