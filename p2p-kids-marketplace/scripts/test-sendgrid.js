/**
 * Quick test script to send a welcome email via SendGrid
 * Run with: node scripts/test-sendgrid.js
 */

const sgMail = require('@sendgrid/mail');

// Get API key from environment
const apiKey = process.env.EXPO_PUBLIC_SENDGRID_API_KEY || process.env.SENDGRID_API_KEY;

if (!apiKey) {
  console.error('❌ Error: SENDGRID_API_KEY not found in environment variables');
  console.error('Please set EXPO_PUBLIC_SENDGRID_API_KEY in your .env.local');
  process.exit(1);
}

// Initialize SendGrid
sgMail.setApiKey(apiKey);

// Email configuration
const FROM_EMAIL = 'samer.alzubaidy@gmail.com';
const REPLY_TO_EMAIL = 'support@p2pkidsmarketplace.com';
const TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_WELCOME || 'd-03b02b1c7a7e4579b6371aafda4fe10a';

// Test email data
const testEmail = {
  to: 'samer.alzubaidi82@gmail.com',
  from: FROM_EMAIL,
  replyTo: REPLY_TO_EMAIL,
  templateId: TEMPLATE_ID,
  dynamicTemplateData: {
    firstName: 'Samer',
    appDownloadLink: 'https://p2pkidsmarketplace.com/app',
  },
};

// Send the email
console.log('📧 Sending test welcome email...');
console.log(`   To: ${testEmail.to}`);
console.log(`   Template ID: ${TEMPLATE_ID}`);
console.log(`   From: ${FROM_EMAIL}`);
console.log('');

sgMail
  .send(testEmail)
  .then(() => {
    console.log('✅ SUCCESS! Welcome email sent successfully');
    console.log('');
    console.log('📊 Email Details:');
    console.log(`   Recipient: samer.alzubaidi82@gmail.com`);
    console.log(`   Template: SENDGRID_TEMPLATE_WELCOME`);
    console.log(`   First Name: Samer`);
    console.log(`   App Link: https://p2pkidsmarketplace.com/app`);
    console.log('');
    console.log('📍 Check your email inbox (or spam folder) in a few moments.');
    console.log('📊 Monitor delivery: https://app.sendgrid.com/activity');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ FAILED to send email');
    console.error('');
    console.error('Error details:');
    console.error(error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response body:', JSON.stringify(error.response.body, null, 2));
    }
    process.exit(1);
  });
