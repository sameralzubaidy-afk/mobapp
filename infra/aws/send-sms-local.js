const AWS = require('aws-sdk');

const SNS = new AWS.SNS({ region: process.env.AWS_REGION || 'us-east-1' });

const phoneNumber = process.argv[2] || process.env.TEST_SMS_NUMBER;
const message = process.argv[3] || 'Test SMS from p2p-kids-marketplace';

if (!phoneNumber) {
  console.error('Usage: node send-sms-local.js <phoneNumber> <message>');
  process.exit(1);
}

(async () => {
  try {
    const res = await SNS.publish({ PhoneNumber: phoneNumber, Message: message }).promise();
    console.log('Sent message', res);
  } catch (err) {
    console.error('Failed', err);
  }
})();
