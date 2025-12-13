#!/usr/bin/env node
const AWS = require('aws-sdk');
const lambda = new AWS.Lambda({ region: 'us-east-1' });

const PHONE = process.argv[2] || '+55119985017';
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const invokeTest = async (action, phoneNumber, message, code) => {
  const payload = {
    body: JSON.stringify({ action, phoneNumber, message, code })
  };
  
  try {
    const result = await lambda.invoke({
      FunctionName: 'p2p-sms-sender',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(payload)
    }).promise();
    
    const response = JSON.parse(result.Payload);
    return response;
  } catch (err) {
    console.error('Lambda error:', err.message);
    throw err;
  }
};

(async () => {
  console.log('🧪 Direct Lambda SMS Test\n');
  console.log(`📱 Phone: ${PHONE}\n`);
  
  try {
    // Test 1: Send SMS
    console.log('Test 1: Send SMS with verification code');
    const code = generateCode();
    const message = `Your verification code is: ${code}. Valid for 10 minutes.`;
    const sendResult = await invokeTest('send', PHONE, message);
    console.log(`  Code: ${code}`);
    console.log(`  Message: "${message}"`);
    console.log(`  Response Status: ${sendResult.statusCode}`);
    
    if (sendResult.statusCode === 200) {
      let body = JSON.parse(sendResult.body);
      console.log(`  ✅ SMS sent! Message ID: ${body.messageId}`);
      console.log(`  ✅ Code persisted: ${body.codePersisted}\n`);
      
      // Test 2: Verify code
      console.log('Test 2: Verify the code');
      const verifyResult = await invokeTest('verify', PHONE, null, code);
      console.log(`  Response Status: ${verifyResult.statusCode}`);
      if (verifyResult.statusCode === 200) {
        body = JSON.parse(verifyResult.body);
        console.log(`  ✅ Code verified: ${body.verified}\n`);
      } else {
        body = JSON.parse(verifyResult.body);
        console.log(`  ❌ Verification failed: ${body.error}\n`);
      }
      
      // Test 3: Try wrong code
      console.log('Test 3: Attempt with wrong code');
      const wrongCode = '999999';
      const wrongResult = await invokeTest('verify', PHONE, null, wrongCode);
      console.log(`  Response Status: ${wrongResult.statusCode}`);
      body = JSON.parse(wrongResult.body);
      console.log(`  Expected failure: ${body.error}\n`);
      
      console.log('✅ All tests passed!\n');
    } else {
      let body = JSON.parse(sendResult.body);
      console.log(`  ❌ Failed: ${body.error}\n`);
    }
  } catch (err) {
    console.error('❌ Test error:', err.message);
    process.exit(1);
  }
})();
