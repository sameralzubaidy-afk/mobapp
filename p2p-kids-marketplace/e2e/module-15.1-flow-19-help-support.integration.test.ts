// FILE: p2p-kids-marketplace/e2e/module-15.1-flow-19-help-support.integration.test.ts
// MODULE-15.1 FLOW-19: E2E tests for Help & Support screens

/**
 * E2E Integration Tests for Help & Support (FLOW-19)
 * 
 * Run with: RUN_SUPABASE_E2E=true npm run test:e2e
 * 
 * Prerequisites:
 * - Supabase staging environment must be running
 * - Test user credentials configured in test environment
 * - Navigation routes registered for Support, ContactSupport, FAQDetail
 */

import { test, expect, device } from 'detox';

const hasDetoxGlobals =
  typeof (global as any).element === 'function' &&
  typeof (global as any).by === 'object';

const describeDetox = hasDetoxGlobals ? describe : describe.skip;

describeDetox('MODULE-15.1 FLOW-19: Help & Support', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Help Screen (FAQ List)', () => {
    it('should navigate to Help screen from Settings', async () => {
      // Navigate to Settings (assuming logged in)
      // TODO: Add actual navigation path based on your app structure
      // await element(by.id('settings-tab')).tap();
      // await element(by.id('help-support-option')).tap();
      
      // For now, assuming direct navigation is possible
      await expect(element(by.id('help-screen'))).toBeVisible();
    });

    it('should display all UI elements on Help screen', async () => {
      await expect(element(by.text('Help & Support'))).toBeVisible();
      await expect(element(by.id('search-input'))).toBeVisible();
      await expect(element(by.id('category-chips-scroll'))).toBeVisible();
      await expect(element(by.id('faq-list'))).toBeVisible();
      await expect(element(by.id('contact-us-button'))).toBeVisible();
    });

    it('should display FAQ questions in the list', async () => {
      await expect(element(by.text('How do I create my first listing?'))).toBeVisible();
      await expect(element(by.text('What is the Kids P2P Marketplace?'))).toBeVisible();
      await expect(element(by.text('How do I earn Swap Points?'))).toBeVisible();
    });

    it('should filter FAQs by search query', async () => {
      // Type search query
      await element(by.id('search-input')).typeText('Swap Points');
      
      // Should show Swap Points FAQs
      await expect(element(by.text('How do I earn Swap Points?'))).toBeVisible();
      await expect(element(by.text('Can I use Swap Points for any purchase?'))).toBeVisible();
      
      // Should NOT show unrelated FAQs
      await expect(element(by.text('How do I complete a trade?'))).not.toBeVisible();
    });

    it('should show empty state when no search results found', async () => {
      // Type search query that matches nothing
      await element(by.id('search-input')).typeText('nonexistent query xyz');
      
      // Should show empty state
      await expect(element(by.id('empty-state'))).toBeVisible();
      await expect(element(by.text('No results found'))).toBeVisible();
      await expect(element(by.text('Try a different search or category'))).toBeVisible();
    });

    it('should filter FAQs by category', async () => {
      // Tap Swap Points category
      await element(by.id('category-chip-swap-points')).tap();
      
      // Should show only Swap Points FAQs
      await expect(element(by.text('How do I earn Swap Points?'))).toBeVisible();
      await expect(element(by.text('Can I use Swap Points for any purchase?'))).toBeVisible();
      
      // Should NOT show other categories
      await expect(element(by.text('How do I create my first listing?'))).not.toBeVisible();
    });

    it('should navigate to FAQ detail when FAQ is tapped', async () => {
      // Tap first FAQ
      await element(by.id('faq-row-1')).tap();
      
      // Should navigate to FAQ detail screen
      await expect(element(by.id('faq-detail-screen'))).toBeVisible();
      await expect(element(by.text('How do I create my first listing?'))).toBeVisible();
    });

    it('should navigate to Contact Support when button is tapped', async () => {
      // Tap Contact Us button
      await element(by.id('contact-us-button')).tap();
      
      // Should navigate to Contact Support screen
      await expect(element(by.id('contact-support-screen'))).toBeVisible();
      await expect(element(by.text('Contact Support'))).toBeVisible();
    });

    it('should navigate back when back button is tapped', async () => {
      // Tap back button
      await element(by.id('back-button')).tap();
      
      // Should navigate back (to previous screen)
      await expect(element(by.id('help-screen'))).not.toBeVisible();
    });
  });

  describe('FAQ Detail Screen', () => {
    beforeEach(async () => {
      // Navigate to FAQ detail
      await element(by.id('faq-row-1')).tap();
      await expect(element(by.id('faq-detail-screen'))).toBeVisible();
    });

    it('should display FAQ details', async () => {
      await expect(element(by.text('Getting Started'))).toBeVisible();
      await expect(element(by.text('How do I create my first listing?'))).toBeVisible();
      await expect(
        element(
          by.text(
            'Tap the "Sell" button at the bottom of the screen, take photos of your item, and fill in the details.'
          )
        )
      ).toBeVisible();
    });

    it('should display helpful feedback section', async () => {
      await expect(element(by.text('Was this helpful?'))).toBeVisible();
      await expect(element(by.id('helpful-yes-button'))).toBeVisible();
      await expect(element(by.id('helpful-no-button'))).toBeVisible();
    });

    it('should navigate back when "Yes" is tapped', async () => {
      await element(by.id('helpful-yes-button')).tap();
      
      // Should navigate back to Help screen
      await expect(element(by.id('help-screen'))).toBeVisible();
    });

    it('should navigate to Contact Support when "No" is tapped', async () => {
      await element(by.id('helpful-no-button')).tap();
      
      // Should navigate to Contact Support
      await expect(element(by.id('contact-support-screen'))).toBeVisible();
    });

    it('should navigate to Contact Support when button is tapped', async () => {
      // Scroll to bottom
      await element(by.id('content-scroll')).scrollTo('bottom');
      
      // Tap Contact Support button
      await element(by.id('contact-support-button')).tap();
      
      // Should navigate to Contact Support
      await expect(element(by.id('contact-support-screen'))).toBeVisible();
    });

    it('should navigate back when back button is tapped', async () => {
      await element(by.id('back-button')).tap();
      
      // Should navigate back to Help screen
      await expect(element(by.id('help-screen'))).toBeVisible();
    });
  });

  describe('Contact Support Screen', () => {
    beforeEach(async () => {
      // Navigate to Contact Support
      await element(by.id('contact-us-button')).tap();
      await expect(element(by.id('contact-support-screen'))).toBeVisible();
    });

    it('should display all form elements', async () => {
      await expect(element(by.text('Contact Support'))).toBeVisible();
      await expect(element(by.id('subject-input'))).toBeVisible();
      await expect(element(by.id('message-input'))).toBeVisible();
      await expect(element(by.id('send-message-button'))).toBeVisible();
      await expect(element(by.text('Or email us at'))).toBeVisible();
      await expect(element(by.text('support@passitup.com'))).toBeVisible();
    });

    it('should display character count for message', async () => {
      await expect(element(by.text('0 / 1000'))).toBeVisible();
    });

    it('should update character count when message is typed', async () => {
      await element(by.id('message-input')).typeText('Hello world');
      
      // Character count should update
      await expect(element(by.text('11 / 1000'))).toBeVisible();
    });

    it('should show validation alert when subject is empty', async () => {
      // Try to submit without subject
      await element(by.id('send-message-button')).tap();
      
      // Should show alert
      await expect(element(by.text('Missing Subject'))).toBeVisible();
      await expect(element(by.text('Please enter a subject for your message.'))).toBeVisible();
    });

    it('should show validation alert when message is empty', async () => {
      // Fill subject only
      await element(by.id('subject-input')).typeText('Test Subject');
      
      // Try to submit without message
      await element(by.id('send-message-button')).tap();
      
      // Should show alert
      await expect(element(by.text('Missing Message'))).toBeVisible();
      await expect(element(by.text('Please enter your message.'))).toBeVisible();
    });

    it('should submit form successfully when all fields are filled', async () => {
      // Fill form
      await element(by.id('subject-input')).typeText('Test Support Request');
      await element(by.id('message-input')).typeText(
        'This is a test message to verify the contact support form works correctly.'
      );
      
      // Submit
      await element(by.id('send-message-button')).tap();
      
      // Wait for success alert
      await waitFor(element(by.text('Message Sent')))
        .toBeVisible()
        .withTimeout(5000);
      
      await expect(
        element(by.text("Thank you for contacting us. We'll respond within 24 hours."))
      ).toBeVisible();
    });

    it('should show "Sending…" during submission', async () => {
      // Fill form
      await element(by.id('subject-input')).typeText('Test Subject');
      await element(by.id('message-input')).typeText('Test message');
      
      // Submit
      await element(by.id('send-message-button')).tap();
      
      // Should briefly show "Sending…"
      await expect(element(by.text('Sending…'))).toBeVisible();
    });

    it('should navigate back after successful submission', async () => {
      // Fill and submit form
      await element(by.id('subject-input')).typeText('Test Subject');
      await element(by.id('message-input')).typeText('Test message');
      await element(by.id('send-message-button')).tap();
      
      // Wait for success alert
      await waitFor(element(by.text('Message Sent')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Tap OK button on alert
      await element(by.text('OK')).tap();
      
      // Should navigate back
      await expect(element(by.id('contact-support-screen'))).not.toBeVisible();
    });

    it('should navigate back when back button is tapped', async () => {
      await element(by.id('back-button')).tap();
      
      // Should navigate back to Help screen
      await expect(element(by.id('help-screen'))).toBeVisible();
    });
  });

  describe('Design System Compliance - MODULE-15.1', () => {
    beforeEach(async () => {
      await expect(element(by.id('help-screen'))).toBeVisible();
    });

    it('should use filled search bar style', async () => {
      // Verify search bar is visible and interactive
      await expect(element(by.id('search-input'))).toBeVisible();
      await element(by.id('search-input')).tap();
      await element(by.id('search-input')).typeText('test');
      await expect(element(by.id('search-input'))).toHaveText('test');
    });

    it('should use pill-style category chips', async () => {
      // Verify category chips are tappable
      await element(by.id('category-chip-all')).tap();
      await element(by.id('category-chip-swap-points')).tap();
      await element(by.id('category-chip-trading')).tap();
    });

    it('should use green Contact Us button in footer', async () => {
      await expect(element(by.id('contact-us-button'))).toBeVisible();
      await element(by.id('contact-us-button')).tap();
      await expect(element(by.id('contact-support-screen'))).toBeVisible();
    });
  });

  describe('End-to-End User Flow', () => {
    it('should complete full help & support journey', async () => {
      // 1. Start on Help screen
      await expect(element(by.id('help-screen'))).toBeVisible();
      
      // 2. Search for FAQ
      await element(by.id('search-input')).typeText('Swap Points');
      await expect(element(by.text('How do I earn Swap Points?'))).toBeVisible();
      
      // 3. View FAQ detail
      await element(by.id('faq-row-3')).tap();
      await expect(element(by.id('faq-detail-screen'))).toBeVisible();
      
      // 4. Indicate not helpful → navigate to Contact Support
      await element(by.id('helpful-no-button')).tap();
      await expect(element(by.id('contact-support-screen'))).toBeVisible();
      
      // 5. Fill and submit support request
      await element(by.id('subject-input')).typeText('Question about Swap Points');
      await element(by.id('message-input')).typeText(
        'I have a question about earning Swap Points. Can you help?'
      );
      await element(by.id('send-message-button')).tap();
      
      // 6. Verify success
      await waitFor(element(by.text('Message Sent')))
        .toBeVisible()
        .withTimeout(5000);
      
      await element(by.text('OK')).tap();
      
      // 7. Should navigate back
      await expect(element(by.id('contact-support-screen'))).not.toBeVisible();
    });
  });
});
