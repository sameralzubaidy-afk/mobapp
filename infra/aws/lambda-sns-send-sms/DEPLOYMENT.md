# AWS SMS Service Deployment Guide

## Overview
This guide walks through deploying the SMS service using AWS SAM (Serverless Application Model) with Lambda, DynamoDB, API Gateway, and SNS integration.

## Prerequisites
- AWS CLI configured with credentials
- SAM CLI installed: `brew install aws-sam-cli`
- Node.js 18.x
- A phone number to test with (your personal phone)

## Step 1: Generate a Secure API Key

Run this locally to generate a random 32-character API key:

```bash
# macOS/Linux
openssl rand -base64 32 | tr -d '=' | cut -c1-32

# Or use this one-liner (Python, any OS)
python3 -c "import secrets; print(secrets.token_hex(16))"
```

Save this key somewhere safe - you'll need it multiple times below.

Example:
```
API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

## Step 2: Build and Deploy Lambda with SAM

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/infra/aws/lambda-sns-send-sms

# Build the SAM template
sam build

# Deploy (interactive - will prompt for parameters)
sam deploy --guided

# Prompts will ask:
# - Stack Name: p2p-sms-service-prod
# - Region: us-east-1
# - SmsRateLimitWindow: 60
# - SmsRateLimitMax: 3
# - SmsCodeExpiry: 600
# - ApiKeyValue: (paste your generated API key)
# - Environment: production
# - Confirm changes: y
# - Allow SAM to create IAM roles: y
```

**Note:** If `sam deploy --guided` is slow or fails, you can create a `samconfig.toml` file manually:

```bash
cat > samconfig.toml << 'EOF'
version = 0.1

[default]
[default.deploy]
parameters = {
  "SmsRateLimitWindow"="60",
  "SmsRateLimitMax"="3",
  "SmsCodeExpiry"="600",
  "ApiKeyValue"="your-generated-api-key",
  "Environment"="production"
}
EOF

# Then just run:
sam deploy
```

After deployment, **note the outputs** printed to console:
- `ApiEndpoint` - the base URL of your API (e.g., `https://abc123.execute-api.us-east-1.amazonaws.com/production`)
- `ApiKeyId` - your API key ID (different from the value you provided)

## Step 3: Store API Endpoint & Key in Supabase Function Secrets

You'll now need to add the API endpoint and key to Supabase so the Edge Function can call it.

Using `supabase secrets set` command (requires Supabase CLI):

```bash
# Install Supabase CLI if you haven't
brew install supabase/tap/supabase

# Log in to your Supabase account
supabase login

# Set the secrets for your project
# Replace YOUR_PROJECT_ID and YOUR_API_KEY (the value you generated)
supabase secrets set AWS_SNS_API_GATEWAY_URL="https://abc123.execute-api.us-east-1.amazonaws.com/production" \
  --project-id YOUR_PROJECT_ID

supabase secrets set AWS_SNS_API_GATEWAY_KEY="your-generated-api-key" \
  --project-id YOUR_PROJECT_ID
```

Alternatively, via Supabase Console:
1. Go to https://app.supabase.com
2. Select your project
3. Navigate to **Settings → Secrets**
4. Click **+ New Secret**
5. Add:
   - Name: `AWS_SNS_API_GATEWAY_URL`
   - Value: `https://abc123.execute-api.us-east-1.amazonaws.com/production`
6. Repeat for `AWS_SNS_API_GATEWAY_KEY`

## Step 4: Verify SNS Spending Limit (AWS Console)

1. Go to AWS Console → SNS → Text messaging (SMS) → Spend limit
2. If limit is not set or too low (default $1), click **Request spend limit increase**
3. Set monthly limit to `$200` (or adjust based on usage)
4. Provide use case: "Phone verification for P2P marketplace app"
5. Usually approved within 24 hours

## Step 5: Deploy Supabase Edge Function

Now that the API endpoint is configured, deploy the Supabase function that proxies to it:

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# Deploy the SMS Edge Function to Supabase
supabase functions deploy sms-send --project-ref YOUR_PROJECT_ID
```

You can test the Edge Function directly:

```bash
# Get your Supabase project URL and anon key
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="eyJhbGc..."

curl -X POST "${SUPABASE_URL}/functions/v1/sms-send" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+15555551234",
    "message": "Your verification code is: 123456"
  }'
```

## Step 6: Add GitHub Secrets (for CI/CD, if needed)

If your CI/CD workflows need to reference AWS resources, add these secrets:

```bash
# Using GitHub CLI
gh secret set AWS_SNS_API_GATEWAY_URL -b "https://abc123.execute-api.us-east-1.amazonaws.com/production"
gh secret set AWS_SNS_API_GATEWAY_KEY -b "your-generated-api-key"

# Optionally, if you have a CI script that needs to send SMS directly:
# (Not recommended for most workflows; prefer using the API endpoint)
# gh secret set AWS_SNS_ACCESS_KEY_ID -b "your-access-key-id"
# gh secret set AWS_SNS_SECRET_ACCESS_KEY -b "your-secret-access-key"
```

## Step 7: Test the End-to-End Flow

Use the test script provided (`test-sms-flow.js`) to verify everything works:

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/infra/aws/lambda-sns-send-sms

# Install dependencies
npm ci

# Run the test (uses SAM local + real AWS)
node test-sms-flow.js --phone-number "+your-real-phone-number" \
  --api-endpoint "https://abc123.execute-api.us-east-1.amazonaws.com/production" \
  --api-key "your-generated-api-key"
```

Or manually using curl:

```bash
# Send an SMS with verification code
curl -X POST "https://abc123.execute-api.us-east-1.amazonaws.com/production/send" \
  -H "x-api-key: your-generated-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "send",
    "phoneNumber": "+15555551234",
    "message": "Your verification code is: 123456"
  }'

# Should get response:
# { "messageId": "...", "codePersisted": true }
```

Check your phone for the SMS!

## Step 8: Verify Code (Optional Test)

To test code verification:

```bash
curl -X POST "https://abc123.execute-api.us-east-1.amazonaws.com/production/send" \
  -H "x-api-key: your-generated-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "verify",
    "phoneNumber": "+15555551234",
    "code": "123456"
  }'

# Should get response:
# { "verified": true }
```

## Monitoring & Troubleshooting

### Check Lambda Logs
```bash
# View real-time logs
sam logs -n SmsSenderFunction --stack-name p2p-sms-service-prod -t

# Or use AWS CLI
aws logs tail /aws/lambda/p2p-sms-sender-production --follow
```

### Check DynamoDB Tables
```bash
# List items in rate limit table
aws dynamodb scan --table-name p2p-sms-rate-production --region us-east-1

# List items in verification codes table
aws dynamodb scan --table-name p2p-verification-codes-production --region us-east-1
```

### Check API Gateway Usage
```bash
# View API metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=p2p-sms-api-production \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

### Monitor Costs
1. Go to AWS Console → Billing & Cost Management → Cost Explorer
2. Filter by service: SNS, DynamoDB, API Gateway, Lambda
3. Expected monthly cost for MVP: $50-100 (mostly SNS)

## Cleanup (if needed)

To delete the stack and all resources:

```bash
aws cloudformation delete-stack --stack-name p2p-sms-service-prod --region us-east-1
```

## Summary of Deployed Resources

| Resource | Name | Notes |
|----------|------|-------|
| Lambda Function | `p2p-sms-sender-production` | Sends SMS and stores/verifies codes |
| API Gateway | `p2p-sms-api-production` | HTTP endpoint (regional) |
| API Key | `p2p-sms-api-key-production` | Secures the endpoint |
| DynamoDB Table 1 | `p2p-sms-rate-production` | Rate limiting per phone number |
| DynamoDB Table 2 | `p2p-verification-codes-production` | Stores and verifies codes |
| CloudFormation Stack | `p2p-sms-service-prod` | Contains all above resources |

## Next Steps

1. ✅ Deploy Lambda, API Gateway, DynamoDB
2. ✅ Configure Supabase secrets
3. ✅ Test SMS sending to your phone
4. 🔄 Integrate into authentication flow (Module 02)
5. 🔄 Add additional endpoints (e.g., trade notifications, SMS alerts)
6. 🔄 Set up CloudWatch alarms for failures and cost
