const AWS = require('aws-sdk');

// Expects these env vars set in Lambda configuration:
// AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (Lambda infra usually has role attached)
// SMS_SENDER_ID optional
// DYNAMODB_TABLE_SMS_RATE for per-phone rate limiting
// DYNAMODB_TABLE_VERIFICATION_CODES for storing and verifying codes

const sns = new AWS.SNS({ apiVersion: '2010-03-31' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const RATE_LIMIT_WINDOW_SECONDS = parseInt(process.env.SMS_RATE_WINDOW_SECONDS || '60', 10); // default 1 minute
const RATE_LIMIT_MAX_PER_WINDOW = parseInt(process.env.SMS_RATE_MAX_PER_WINDOW || '3', 10);
const CODE_EXPIRY_SECONDS = parseInt(process.env.SMS_CODE_EXPIRY_SECONDS || '600', 10); // default 10 minutes

const sendSMS = async (phoneNumber, message) => {
  const params = {
    Message: message,
    PhoneNumber: phoneNumber,
  };
  if (process.env.SMS_SENDER_ID) {
    params.MessageAttributes = {
      'AWS.SNS.SMS.SenderID': {
        DataType: 'String',
        StringValue: process.env.SMS_SENDER_ID,
      },
    };
  }
  return sns.publish(params).promise();
};

const checkRateLimit = async (phoneNumber) => {
  const table = process.env.DYNAMODB_TABLE_SMS_RATE;
  if (!table) return { allowed: true };
  const now = Math.floor(Date.now() / 1000);

  const key = { phone: phoneNumber };

  // Increment counter with TTL approach: use UpdateExpression to add to count and set lastModified
  const res = await dynamodb
    .update({
      TableName: table,
      Key: key,
      UpdateExpression: 'SET #count = if_not_exists(#count, :zero) + :inc, lastModified = :now',
      ExpressionAttributeNames: { '#count': 'count' },
      ExpressionAttributeValues: { ':inc': 1, ':now': now, ':zero': 0 },
      ReturnValues: 'UPDATED_NEW',
    })
    .promise();

  const count = res.Attributes && res.Attributes.count ? res.Attributes.count : 0;
  if (count > RATE_LIMIT_MAX_PER_WINDOW) {
    return { allowed: false, count };
  }

  return { allowed: true, count };
};

const storeVerificationCode = async (phoneNumber, code) => {
  const table = process.env.DYNAMODB_TABLE_VERIFICATION_CODES;
  if (!table) {
    console.warn('DYNAMODB_TABLE_VERIFICATION_CODES not set; code storage skipped');
    return { success: false, reason: 'table_not_configured' };
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + CODE_EXPIRY_SECONDS;

  try {
    await dynamodb
      .put({
        TableName: table,
        Item: {
          phone: phoneNumber,
          code: code,
          createdAt: now,
          expiresAt: expiresAt, // Used by DynamoDB TTL
          attempts: 0,
        },
      })
      .promise();
    return { success: true };
  } catch (err) {
    console.error('Failed to store verification code:', err);
    return { success: false, reason: err.message };
  }
};

const verifyCode = async (phoneNumber, code) => {
  const table = process.env.DYNAMODB_TABLE_VERIFICATION_CODES;
  if (!table) {
    return { valid: false, reason: 'table_not_configured' };
  }

  try {
    const res = await dynamodb
      .get({
        TableName: table,
        Key: { phone: phoneNumber },
      })
      .promise();

    const item = res.Item;
    if (!item) {
      return { valid: false, reason: 'code_not_found' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (item.expiresAt < now) {
      return { valid: false, reason: 'code_expired' };
    }

    if (item.code !== code) {
      // Increment attempts
      await dynamodb
        .update({
          TableName: table,
          Key: { phone: phoneNumber },
          UpdateExpression: 'SET attempts = attempts + :inc',
          ExpressionAttributeValues: { ':inc': 1 },
        })
        .promise();
      return { valid: false, reason: 'code_mismatch' };
    }

    // Valid code: delete it so it can't be reused
    await dynamodb
      .delete({
        TableName: table,
        Key: { phone: phoneNumber },
      })
      .promise();

    return { valid: true };
  } catch (err) {
    console.error('Failed to verify code:', err);
    return { valid: false, reason: err.message };
  }
};

exports.handler = async (event) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { action, phoneNumber, message, code } = body || {};

    if (action === 'send') {
      // Send SMS with verification code
      if (!phoneNumber || !message) {
        return { statusCode: 400, body: JSON.stringify({ error: 'phoneNumber and message required' }) };
      }

      // Rate limiting
      const rl = await checkRateLimit(phoneNumber);
      if (!rl.allowed) {
        return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit exceeded' }) };
      }

      // Extract 6-digit code from message (e.g., "Your code is: 123456")
      const codeMatch = message.match(/(\d{6})/);
      const extractedCode = codeMatch ? codeMatch[1] : null;

      // Store the code in DynamoDB
      if (extractedCode) {
        const storeRes = await storeVerificationCode(phoneNumber, extractedCode);
        if (!storeRes.success) {
          console.warn('Failed to store verification code:', storeRes.reason);
        }
      }

      const smsResult = await sendSMS(phoneNumber, message);

      return { statusCode: 200, body: JSON.stringify({ messageId: smsResult.MessageId, codePersisted: !!extractedCode }) };
    } else if (action === 'verify') {
      // Verify a code for a phone number
      if (!phoneNumber || !code) {
        return { statusCode: 400, body: JSON.stringify({ error: 'phoneNumber and code required' }) };
      }

      const verifyRes = await verifyCode(phoneNumber, code);
      if (!verifyRes.valid) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid code', reason: verifyRes.reason }) };
      }

      return { statusCode: 200, body: JSON.stringify({ verified: true }) };
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action; use "send" or "verify"' }) };
    }
  } catch (err) {
    console.error('Lambda Error', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error', details: err.message }) };
  }
};
