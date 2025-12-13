# lambda-sns-send-sms

Node.js AWS Lambda function for sending SMS via AWS SNS with verification code storage and validation.

## Features
- ✅ **Send SMS** via AWS SNS with 6-digit verification codes
- ✅ **Store codes** in DynamoDB with automatic expiration (TTL)
- ✅ **Verify codes** with attempt tracking and one-time use
- ✅ **Rate limiting** per phone number (default: 3 SMS/min)
- ✅ **API Gateway protection** via API key
- ✅ **Auto-scaling** with DynamoDB on-demand billing

## Deployment

Use SAM (Serverless Application Model) for easy deployment:

```bash
cd infra/aws/lambda-sns-send-sms

# Build
sam build

# Deploy (interactive)
sam deploy --guided
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete step-by-step instructions.

## Environment Variables

Set these in the Lambda configuration (auto-set by SAM template):
- `DYNAMODB_TABLE_SMS_RATE` - Table for rate limiting
- `DYNAMODB_TABLE_VERIFICATION_CODES` - Table for storing codes
- `SMS_RATE_WINDOW_SECONDS` - (optional, default 60) Rate limit window
- `SMS_RATE_MAX_PER_WINDOW` - (optional, default 3) Max SMS per window
- `SMS_CODE_EXPIRY_SECONDS` - (optional, default 600) Code expiration time

## API: Send SMS

```bash
curl -X POST "https://<api>.execute-api.<region>.amazonaws.com/<stage>/send" \
  -H "x-api-key: <api-key>" \
  -H "Content-Type: application/json" \
  -d '{"action":"send","phoneNumber":"+1555...","message":"Code: 123456"}'
```

## API: Verify Code

```bash
curl -X POST "https://<api>.execute-api.<region>.amazonaws.com/<stage>/send" \
  -H "x-api-key: <api-key>" \
  -H "Content-Type: application/json" \
  -d '{"action":"verify","phoneNumber":"+1555...","code":"123456"}'
```

## Testing

```bash
node test-sms-flow.js \
  --phone-number "+15551234567" \
  --api-endpoint "https://..." \
  --api-key "..."
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete setup and testing instructions.
