# AWS Infrastructure Scripts & SMS Service

Complete AWS SMS service for the P2P Kids Marketplace using SNS, Lambda, API Gateway, and DynamoDB.

## What's Included

### 1. SMS Lambda Function (`lambda-sns-send-sms/`)
- **Sends SMS** via AWS SNS with 6-digit verification codes
- **Stores codes** in DynamoDB with automatic expiration (TTL)
- **Verifies codes** with one-time use enforcement
- **Rate limits** per phone number (default: 3 SMS/60 sec)
- **Secured API** via API Gateway with x-api-key authentication
- **Auto-scales** with DynamoDB on-demand billing

### 2. SAM CloudFormation Template (`template.yaml`)
- Deploys Lambda function
- Creates API Gateway with authentication
- Creates 2 DynamoDB tables (rate-limiting + codes)
- Sets up IAM roles and permissions
- Configures usage plans and throttling

### 3. Test Scripts
- **`test-sms-flow.js`** - End-to-end test with 6 test cases
- **`send-sms-local.js`** - Quick local test using AWS SDK directly

## Quick Start

### 1. Generate API Key
```bash
python3 -c "import secrets; print(secrets.token_hex(16))"
```

### 2. Deploy with SAM
```bash
cd lambda-sns-send-sms
sam build
sam deploy --guided
```

When prompted, provide:
- Stack name: `p2p-sms-service-prod`
- Region: `us-east-1`
- ApiKeyValue: (your generated key)
- Environment: `production`

### 3. Save Outputs
After deployment, note:
- **ApiEndpoint** - Your API base URL
- **ApiKeyId** - API key identifier

### 4. Configure Supabase Function Secrets
```bash
supabase secrets set AWS_SNS_API_GATEWAY_URL="https://..." --project-id YOUR_PROJECT_ID
supabase secrets set AWS_SNS_API_GATEWAY_KEY="your-api-key" --project-id YOUR_PROJECT_ID
```

### 5. Deploy Supabase Edge Function
```bash
supabase functions deploy sms-send --project-ref YOUR_PROJECT_ID
```

### 6. Test SMS Sending
```bash
cd lambda-sns-send-sms
node test-sms-flow.js \
  --phone-number "+15551234567" \
  --api-endpoint "https://xxx.execute-api.us-east-1.amazonaws.com/production" \
  --api-key "your-api-key"
```

You should receive an SMS within seconds!

## Files & Documentation

| File | Purpose |
|------|---------|
| `lambda-sns-send-sms/index.js` | Lambda handler (send, verify, rate limit, store) |
| `lambda-sns-send-sms/template.yaml` | SAM template for full infrastructure |
| `lambda-sns-send-sms/package.json` | Node.js dependencies |
| `lambda-sns-send-sms/DEPLOYMENT.md` | Detailed step-by-step guide |
| `lambda-sns-send-sms/CHECKLIST.md` | Task completion checklist |
| `lambda-sns-send-sms/test-sms-flow.js` | End-to-end test script |
| `send-sms-local.js` | Local test (requires AWS credentials) |
| `README.md` | This file |

## API Endpoints

### Send SMS with Verification Code
```bash
curl -X POST "https://<api-id>.execute-api.us-east-1.amazonaws.com/production/send" \
  -H "x-api-key: <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "send",
    "phoneNumber": "+15551234567",
    "message": "Your verification code is: 123456"
  }'
```

### Verify Code
```bash
curl -X POST "https://<api-id>.execute-api.us-east-1.amazonaws.com/production/send" \
  -H "x-api-key: <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "verify",
    "phoneNumber": "+15551234567",
    "code": "123456"
  }'
```

## Environment Variables

### For Supabase Edge Function
```bash
AWS_SNS_API_GATEWAY_URL=https://xxx.execute-api.us-east-1.amazonaws.com/production
AWS_SNS_API_GATEWAY_KEY=your-generated-api-key
```

### For Mobile App
```bash
EXPO_PUBLIC_SMS_API_URL=https://your-supabase.supabase.co/functions/v1/sms-send
```

### For GitHub CI/CD
```bash
AWS_SNS_API_GATEWAY_URL
AWS_SNS_API_GATEWAY_KEY
```

## Cost Estimation

**Monthly estimate for MVP (10K active users):**
- **SNS**: $50-100 (7.5-15K SMS @ $0.00645/SMS to US)
- **DynamoDB**: $5-10 (on-demand, < 50GB)
- **API Gateway**: $1 (minimal requests)
- **Lambda**: < $1 (< 50K invocations)

**Total: $50-115/month** (well within free tier for first 6 months)

## Features

✅ **Secure**: API key authentication, no credentials in client  
✅ **Reliable**: Rate limiting, code expiration, one-time use  
✅ **Scalable**: DynamoDB on-demand, auto-scaling Lambda  
✅ **Monitored**: CloudWatch logs, Lambda errors, DynamoDB metrics  
✅ **Cost-effective**: Pay only for what you use  
✅ **Tested**: 6 end-to-end test cases included  

## Monitoring & Troubleshooting

### View Lambda Logs
```bash
aws logs tail /aws/lambda/p2p-sms-sender-production --follow
```

### Check DynamoDB Tables
```bash
aws dynamodb scan --table-name p2p-sms-rate-production
aws dynamodb scan --table-name p2p-verification-codes-production
```

### Set CloudWatch Alarms
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name sms-sender-errors \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --threshold 5 \
  --comparison-operator GreaterThanOrEqualToThreshold
```

## Security Best Practices

- ✅ **No client-side AWS keys** - API Gateway + API key only
- ✅ **Code expiration** - 10 minutes by default (configurable)
- ✅ **One-time use** - Codes deleted after verification
- ✅ **Rate limiting** - 3 SMS per minute per phone number
- ✅ **HTTPS only** - API Gateway enforces TLS
- ✅ **IAM roles** - Least-privilege Lambda permissions

## Local Testing (Advanced)

If you have AWS credentials in your shell:

```bash
npm install
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
node send-sms-local.js "+15551234567" "Test message"
```

## Next Steps

1. ✅ Deploy Lambda with SAM
2. ✅ Configure Supabase function secrets
3. ✅ Test SMS with `test-sms-flow.js`
4. 🔄 Integrate into auth flow (Module 02)
5. 🔄 Add trade notification endpoint
6. 🔄 Monitor costs and set alarms

## Detailed Documentation

- **[DEPLOYMENT.md](lambda-sns-send-sms/DEPLOYMENT.md)** - Complete step-by-step setup guide
- **[CHECKLIST.md](lambda-sns-send-sms/CHECKLIST.md)** - Task completion checklist
- **[lambda-sns-send-sms/README.md](lambda-sns-send-sms/README.md)** - Lambda function details

## Questions?

Check the DEPLOYMENT.md file for:
- Troubleshooting section
- Monitoring & logging
- Cost management
- Security best practices

---

**Status**: ✅ Ready for production deployment  
**Last Updated**: December 13, 2025
