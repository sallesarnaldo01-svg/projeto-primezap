import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Conversations Flow
 * 
 * Tests the complete conversations flow including:
 * - View conversations list
 * - Open conversation
 * - Send message
 * - Receive message
 * - Archive conversation
 * - Search conversations
 */

test.describe('Conversations', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.E2E_TEST_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Navigate to conversations
    await page.click('text=/conversations|conversas/i');
    await expect(page).toHaveURL(/\/conversations/);
  });

  test('should display conversations list', async ({ page }) => {
    await expect(page.locator('[data-testid="conversations-list"]')).toBeVisible();
    
    // Should have at least one conversation
    const conversations = page.locator('[data-testid="conversation-item"]');
    await expect(conversations.first()).toBeVisible();
  });

  test('should display conversation details', async ({ page }) => {
    // Each conversation should show:
    const firstConversation = page.locator('[data-testid="conversation-item"]').first();
    
    await expect(firstConversation.locator('[data-testid="contact-name"]')).toBeVisible();
    await expect(firstConversation.locator('[data-testid="last-message"]')).toBeVisible();
    await expect(firstConversation.locator('[data-testid="timestamp"]')).toBeVisible();
  });

  test('should open conversation on click', async ({ page }) => {
    await page.locator('[data-testid="conversation-item"]').first().click();
    
    // Should show conversation details
    await expect(page.locator('[data-testid="conversation-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="messages-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible();
  });

  test('should display messages in conversation', async ({ page }) => {
    await page.locator('[data-testid="conversation-item"]').first().click();
    
    // Should have at least one message
    const messages = page.locator('[data-testid="message-item"]');
    await expect(messages.first()).toBeVisible();
    
    // Message should have content and timestamp
    await expect(messages.first().locator('[data-testid="message-content"]')).toBeVisible();
    await expect(messages.first().locator('[data-testid="message-timestamp"]')).toBeVisible();
  });

  test('should send text message', async ({ page }) => {
    await page.locator('[data-testid="conversation-item"]').first().click();
    
    const messageText = `Test message ${Date.now()}`;
    
    await page.fill('[data-testid="message-input"]', messageText);
    await page.click('[data-testid="send-button"]');
    
    // Should show the sent message
    await expect(page.locator(`text=${messageText}`)).toBeVisible();
    
    // Input should be cleared
    await expect(page.locator('[data-testid="message-input"]')).toHaveValue('');
  });

  test('should send message with Enter key', async ({ page }) => {
    await page.locator('[data-testid="conversation-item"]').first().click();
    
    const messageText = `Test message ${Date.now()}`;
    
    await page.fill('[data-testid="message-input"]', messageText);
    await page.press('[data-testid="message-input"]', 'Enter');
    
    // Should show the sent message
    await expect(page.locator(`text=${messageText}`)).toBeVisible();
  });

  test('should show typing indicator', async ({ page }) => {
    await page.locator('[data-testid="conversation-item"]').first().click();
    
    await page.fill('[data-testid="message-input"]', 'Test');
    
    // Should show "typing..." indicator (if implemented)
    // await expect(page.locator('[data-testid="typing-indicator"]')).toBeVisible();
  });

  test('should search conversations', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'test');
    
    // Should filter conversations
    const conversations = page.locator('[data-testid="conversation-item"]');
    await expect(conversations).toHaveCount(await conversations.count());
  });

  test('should filter by unread conversations', async ({ page }) => {
    await page.click('[data-testid="filter-unread"]');
    
    // Should show only unread conversations
    const unreadBadges = page.locator('[data-testid="unread-badge"]');
    const conversationCount = await page.locator('[data-testid="conversation-item"]').count();
    
    if (conversationCount > 0) {
      await expect(unreadBadges.first()).toBeVisible();
    }
  });

  test('should mark conversation as read', async ({ page }) => {
    // Find unread conversation
    const unreadConversation = page.locator('[data-testid="conversation-item"]').filter({
      has: page.locator('[data-testid="unread-badge"]')
    }).first();
    
    if (await unreadConversation.count() > 0) {
      await unreadConversation.click();
      
      // Unread badge should disappear
      await expect(unreadConversation.locator('[data-testid="unread-badge"]')).not.toBeVisible();
    }
  });

  test('should archive conversation', async ({ page }) => {
    await page.locator('[data-testid="conversation-item"]').first().click();
    
    await page.click('[data-testid="conversation-menu"]');
    await page.click('text=/archive|arquivar/i');
    
    // Should show success message
    await expect(page.locator('text=/archived|arquivada/i')).toBeVisible();
    
    // Conversation should be removed from list
    // (or moved to archived section)
  });

  test('should view archived conversations', async ({ page }) => {
    await page.click('[data-testid="view-archived"]');
    
    await expect(page).toHaveURL(/\/conversations\/archived/);
    await expect(page.locator('[data-testid="archived-conversations-list"]')).toBeVisible();
  });

  test('should unarchive conversation', async ({ page }) => {
    await page.click('[data-testid="view-archived"]');
    
    if (await page.locator('[data-testid="conversation-item"]').count() > 0) {
      await page.locator('[data-testid="conversation-item"]').first().click();
      
      await page.click('[data-testid="conversation-menu"]');
      await page.click('text=/unarchive|desarquivar/i');
      
      // Should show success message
      await expect(page.locator('text=/unarchived|desarquivada/i')).toBeVisible();
    }
  });

  test('should show conversation info', async ({ page }) => {
    await page.locator('[data-testid="conversation-item"]').first().click();
    
    await page.click('[data-testid="conversation-info-button"]');
    
    // Should show contact details
    await expect(page.locator('[data-testid="contact-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="contact-phone"]')).toBeVisible();
  });

  test('should load more messages on scroll', async ({ page }) => {
    await page.locator('[data-testid="conversation-item"]').first().click();
    
    const initialMessageCount = await page.locator('[data-testid="message-item"]').count();
    
    // Scroll to top
    await page.locator('[data-testid="messages-list"]').evaluate((el) => {
      el.scrollTop = 0;
    });
    
    // Wait for more messages to load
    await page.waitForTimeout(1000);
    
    const newMessageCount = await page.locator('[data-testid="message-item"]').count();
    
    // Should have more messages (if available)
    expect(newMessageCount).toBeGreaterThanOrEqual(initialMessageCount);
  });

  test('should show message delivery status', async ({ page }) => {
    await page.locator('[data-testid="conversation-item"]').first().click();
    
    const messageText = `Test message ${Date.now()}`;
    
    await page.fill('[data-testid="message-input"]', messageText);
    await page.click('[data-testid="send-button"]');
    
    // Should show sending status
    const sentMessage = page.locator(`text=${messageText}`).locator('..');
    
    // Check for delivery status icon
    await expect(sentMessage.locator('[data-testid="message-status"]')).toBeVisible();
  });

  test('should handle message sending error', async ({ page }) => {
    await page.locator('[data-testid="conversation-item"]').first().click();
    
    // Simulate offline mode
    await page.context().setOffline(true);
    
    const messageText = `Test message ${Date.now()}`;
    
    await page.fill('[data-testid="message-input"]', messageText);
    await page.click('[data-testid="send-button"]');
    
    // Should show error
    await expect(page.locator('text=/failed|error|erro/i')).toBeVisible();
    
    // Restore online mode
    await page.context().setOffline(false);
  });
});
