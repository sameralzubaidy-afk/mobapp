# INFRA-009: AWS SNS Setup Checklist

Use this checklist to track deployment progress. Check off each item as you complete it.

## Phase 1: Pre-Deployment (Local)
- [ ] **Review code**: Enhanced Lambda in `infra/aws/lambda-sns-send-sms/index.js`
  - Supports: send SMS + store code, verify code, rate limiting, DynamoDB integration
- [ ] **Review SAM template**: `infra/aws/lambda-sns-send-sms/template.yaml`
  - Auto-creates: Lambda, API Gateway, DynamoDB tables x2, IAM roles
- [ ] **Generate API Key**: Run this locally
  ```bash
  python3 -c "import secrets; print(secrets.token_hex(16))"
  ```
  - Save the key securely (you'll need it multiple times)

## Phase 2: Deploy Lambda & Infrastructure (AWS)
- [ ] **Install SAM CLI**: `brew install aws-sam-cli`
- [ ] **Configure AWS CLI**: `aws configure` (or verify existing config)
- [ ] **Build SAM project**:
  ```bash
  cd infra/aws/lambda-sns-send-sms
  sam build
  ```
- [ ] **Deploy SAM stack** (interactive):
  ```bash
  sam deploy --guided
  ```
  - Stack name: `p2p-sms-service-prod`
  - Region: `us-east-1`
  - SmsRateLimitWindow: `60`
  - SmsRateLimitMax: `3`
  - SmsCodeExpiry: `600`
  - ApiKeyValue: `<your-generated-api-key>`
  - Environment: `production`
  - Confirm changes: `y`
  - Allow IAM role creation: `y`
- [ ] **Save outputs** from SAM deployment:
  - `ApiEndpoint` = `https://xxxx.execute-api.us-east-1.amazonaws.com/production`
  - `ApiKeyId` = (note for reference)
  - `SmsFunctionArn` = (for CloudWatch alarms later)

## Phase 3: Configure AWS SNS Spending Limit
- [ ] **Check SNS spending limit** in AWS Console:
  - Go to: SNS → Text messaging (SMS) → Spend limit
  - If < $200: Click "Request spend limit increase"
  - Set limit: `$200` (or your preferred monthly budget)
  - Reason: "Phone verification for P2P marketplace app"
  - Wait for approval (usually 24 hours, but often instant for new accounts)

## Phase 4: Configure Supabase Function Secrets
- [ ] **Set Supabase secrets** (using Supabase CLI or Console):
  ```bash
  supabase secrets set AWS_SNS_API_GATEWAY_URL="https://xxx.execute-api.us-east-1.amazonaws.com/production" \
    --project-id YOUR_PROJECT_ID
  supabase secrets set AWS_SNS_API_GATEWAY_KEY="<your-generated-api-key>" \
    --project-id YOUR_PROJECT_ID
  ```
  - Or: Supabase Console → Settings → Secrets → Add each one

## Phase 5: Deploy Supabase Edge Function
- [ ] **Deploy Edge Function** to Supabase:
  ```bash
  cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
  supabase functions deploy sms-send --project-ref YOUR_PROJECT_ID
  ```

## Phase 6: Add GitHub Secrets (Optional, for CI/CD)
- [ ] **Add secrets to GitHub** (if using CI/CD workflows):
  ```bash
  gh secret set AWS_SNS_API_GATEWAY_URL -b "https://xxx.execute-api.us-east-1.amazonaws.com/production"
  gh secret set AWS_SNS_API_GATEWAY_KEY -b "<your-generated-api-key>"
  ```

## Phase 7: Test End-to-End
- [ ] **Run SMS test script**:
  ```bash
  cd infra/aws/lambda-sns-send-sms
  node test-sms-flow.js \
    --phone-number "+your-real-phone-number" \
    --api-endpoint "https://xxx.execute-api.us-east-1.amazonaws.com/production" \
    --api-key "<your-generated-api-key>"
  ```
- [ ] **Verify you received SMS** on your phone
- [ ] **Check Lambda logs** if test failed:
  ```bash
  aws logs tail /aws/lambda/p2p-sms-sender-production --follow
  ```
- [ ] **All 6 test cases passed**:
  - [ ] SMS sent successfully
  - [ ] Code verified
  - [ ] Code reuse prevented
  - [ ] Rate limiting works
  - [ ] Wrong codes rejected
  - [ ] Multiple codes work

## Phase 8: Configure Mobile App
- [ ] **Update mobile app env vars** in `p2p-kids-marketplace/.env.local`:
  ```bash
  EXPO_PUBLIC_SMS_API_URL=https://xxx.execute-api.us-east-1.amazonaws.com/production/send
  ```
- [ ] **Test SMS from mobile app** (when auth flow is implemented)

## Phase 9: Monitor & Maintain
- [ ] **Set up CloudWatch alarms** (optional but recommended):
  ```bash
  # Lambda error alarm
  aws cloudwatch put-metric-alarm \
    --alarm-name sms-sender-errors \
    --metric-name Errors \
    --namespace AWS/Lambda \
    --threshold 5 \
    --comparison-operator GreaterThanOrEqualToThreshold
  ```
- [ ] **Monitor costs** in AWS Billing & Cost Management
  - Expected: $50-100/month for MVP usage
- [ ] **Review Lambda logs weekly** for failures or anomalies
- [ ] **Set spending alerts** in AWS Console

## Troubleshooting

### SAM Deploy Fails
- [ ] AWS CLI credentials configured: `aws sts get-caller-identity`
- [ ] Region set: `aws configure get region`
- [ ] Check SAM CLI version: `sam --version` (should be 1.x+)

### SMS Not Sending
- [ ] Check SNS spending limit is raised (not stuck at $1)
- [ ] Check IAM role has SNS permissions (SAM should handle this)
- [ ] Review Lambda logs: `aws logs tail /aws/lambda/p2p-sms-sender-production --follow`

### API Gateway Returns 403 Forbidden
- [ ] Verify API key is correct in request header: `-H "x-api-key: xxx"`
- [ ] Check API key is enabled in API Gateway console
- [ ] Ensure API key is linked to the usage plan

### DynamoDB Write Errors
- [ ] Verify tables exist: `aws dynamodb list-tables`
- [ ] Check table names match Lambda env vars (SAM should set them)
- [ ] DynamoDB on-demand billing should be automatic (no need to reserve capacity)

## Files Reference

| File | Purpose |
|------|---------|
| `infra/aws/lambda-sns-send-sms/index.js` | Lambda function code |
| `infra/aws/lambda-sns-send-sms/template.yaml` | SAM CloudFormation template |
| `infra/aws/lambda-sns-send-sms/DEPLOYMENT.md` | Detailed deployment guide |
| `infra/aws/lambda-sns-send-sms/test-sms-flow.js` | End-to-end test script |
| `infra/aws/send-sms-local.js` | Local test script (requires AWS creds) |
| `supabase/functions/sms-send/index.ts` | Supabase Edge Function proxy |
| `p2p-kids-marketplace/src/services/sms.ts` | Mobile client SMS service |

## Notes

- **Decision**: Using dedicated Lambda + API Gateway (not SNS direct from client)
  - Pro: Secure, rate-limited, verification codes persisted
  - Con: Extra AWS service (minimal cost)
- **Rate Limiting**: DynamoDB-based, per phone number
- **Code Expiration**: DynamoDB TTL auto-deletes expired codes
- **One-time Use**: Codes deleted after verification succeeds
- **API Protection**: x-api-key header required (API Gateway enforces)

## Success Criteria

✅ **Task is complete when:**
1. SAM stack deployed to AWS (Lambda, API Gateway, DynamoDB tables exist)
2. API key generated and configured in Supabase function secrets
3. Test script runs successfully and sends SMS to your phone
4. You received the test SMS
5. All 6 test cases pass
6. Mobile app can call the API via Supabase Edge Function
7. GitHub secrets added (if CI/CD required)

---

**Next Step**: Module 02 - Authentication (integrate SMS verification into signup flow)
