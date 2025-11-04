import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Contacts Flow
 * 
 * Tests the complete contacts management flow including:
 * - View contacts list
 * - Create contact
 * - Edit contact
 * - Delete contact
 * - Search contacts
 * - Import contacts
 * - Export contacts
 */

test.describe('Contacts', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.E2E_TEST_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Navigate to contacts
    await page.click('text=/contacts|contatos/i');
    await expect(page).toHaveURL(/\/contacts/);
  });

  test('should display contacts list', async ({ page }) => {
    await expect(page.locator('[data-testid="contacts-list"]')).toBeVisible();
    
    // Should have table headers
    await expect(page.locator('th:has-text("Name")')).toBeVisible();
    await expect(page.locator('th:has-text("Phone")')).toBeVisible();
    await expect(page.locator('th:has-text("Email")')).toBeVisible();
  });

  test('should open create contact dialog', async ({ page }) => {
    await page.click('[data-testid="create-contact-button"]');
    
    await expect(page.locator('[data-testid="contact-dialog"]')).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="phone"]')).toBeVisible();
  });

  test('should create new contact', async ({ page }) => {
    await page.click('[data-testid="create-contact-button"]');
    
    const contactName = `Test Contact ${Date.now()}`;
    const contactPhone = '+5511999999999';
    const contactEmail = `test${Date.now()}@example.com`;
    
    await page.fill('input[name="name"]', contactName);
    await page.fill('input[name="phone"]', contactPhone);
    await page.fill('input[name="email"]', contactEmail);
    
    await page.click('[data-testid="save-contact-button"]');
    
    // Should show success message
    await expect(page.locator('text=/contact.*created|contato.*criado/i')).toBeVisible();
    
    // Should show new contact in list
    await expect(page.locator(`text=${contactName}`)).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.click('[data-testid="create-contact-button"]');
    
    await page.click('[data-testid="save-contact-button"]');
    
    // Should show validation errors
    await expect(page.locator('text=/name.*required/i')).toBeVisible();
    await expect(page.locator('text=/phone.*required/i')).toBeVisible();
  });

  test('should validate phone format', async ({ page }) => {
    await page.click('[data-testid="create-contact-button"]');
    
    await page.fill('input[name="name"]', 'Test Contact');
    await page.fill('input[name="phone"]', '123'); // Invalid phone
    
    await page.click('[data-testid="save-contact-button"]');
    
    // Should show validation error
    await expect(page.locator('text=/invalid.*phone/i')).toBeVisible();
  });

  test('should edit existing contact', async ({ page }) => {
    // Click edit on first contact
    await page.locator('[data-testid="edit-contact-button"]').first().click();
    
    await expect(page.locator('[data-testid="contact-dialog"]')).toBeVisible();
    
    const newName = `Updated Contact ${Date.now()}`;
    
    await page.fill('input[name="name"]', newName);
    await page.click('[data-testid="save-contact-button"]');
    
    // Should show success message
    await expect(page.locator('text=/contact.*updated|contato.*atualizado/i')).toBeVisible();
    
    // Should show updated name
    await expect(page.locator(`text=${newName}`)).toBeVisible();
  });

  test('should delete contact', async ({ page }) => {
    // Click delete on first contact
    await page.locator('[data-testid="delete-contact-button"]').first().click();
    
    // Should show confirmation dialog
    await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible();
    
    await page.click('[data-testid="confirm-delete-button"]');
    
    // Should show success message
    await expect(page.locator('text=/contact.*deleted|contato.*excluído/i')).toBeVisible();
  });

  test('should cancel delete operation', async ({ page }) => {
    const initialCount = await page.locator('[data-testid="contact-row"]').count();
    
    await page.locator('[data-testid="delete-contact-button"]').first().click();
    await page.click('[data-testid="cancel-delete-button"]');
    
    // Count should remain the same
    const finalCount = await page.locator('[data-testid="contact-row"]').count();
    expect(finalCount).toBe(initialCount);
  });

  test('should search contacts', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'test');
    
    // Should filter contacts
    const contacts = page.locator('[data-testid="contact-row"]');
    const count = await contacts.count();
    
    // All visible contacts should contain "test"
    for (let i = 0; i < count; i++) {
      const text = await contacts.nth(i).textContent();
      expect(text?.toLowerCase()).toContain('test');
    }
  });

  test('should filter by tags', async ({ page }) => {
    await page.click('[data-testid="filter-button"]');
    await page.click('[data-testid="tag-filter-vip"]');
    
    // Should show only VIP contacts
    const contacts = page.locator('[data-testid="contact-row"]');
    const count = await contacts.count();
    
    if (count > 0) {
      await expect(contacts.first().locator('[data-testid="tag-vip"]')).toBeVisible();
    }
  });

  test('should paginate contacts', async ({ page }) => {
    // Check if pagination exists
    const pagination = page.locator('[data-testid="pagination"]');
    
    if (await pagination.isVisible()) {
      const initialFirstContact = await page.locator('[data-testid="contact-row"]').first().textContent();
      
      await page.click('[data-testid="next-page-button"]');
      
      const newFirstContact = await page.locator('[data-testid="contact-row"]').first().textContent();
      
      // First contact should be different
      expect(newFirstContact).not.toBe(initialFirstContact);
    }
  });

  test('should change items per page', async ({ page }) => {
    const initialCount = await page.locator('[data-testid="contact-row"]').count();
    
    await page.selectOption('[data-testid="per-page-select"]', '50');
    
    await page.waitForTimeout(500);
    
    const newCount = await page.locator('[data-testid="contact-row"]').count();
    
    // Should show more contacts (if available)
    expect(newCount).toBeGreaterThanOrEqual(initialCount);
  });

  test('should open import dialog', async ({ page }) => {
    await page.click('[data-testid="import-button"]');
    
    await expect(page.locator('[data-testid="import-dialog"]')).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeVisible();
  });

  test('should export contacts', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-button"]')
    ]);
    
    // Should download file
    expect(download.suggestedFilename()).toMatch(/contacts.*\.(csv|xlsx)/);
  });

  test('should view contact details', async ({ page }) => {
    await page.locator('[data-testid="contact-row"]').first().click();
    
    await expect(page.locator('[data-testid="contact-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="contact-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="contact-phone"]')).toBeVisible();
  });

  test('should add tag to contact', async ({ page }) => {
    await page.locator('[data-testid="contact-row"]').first().click();
    
    await page.click('[data-testid="add-tag-button"]');
    await page.fill('[data-testid="tag-input"]', 'VIP');
    await page.press('[data-testid="tag-input"]', 'Enter');
    
    // Should show tag
    await expect(page.locator('[data-testid="tag-vip"]')).toBeVisible();
  });

  test('should remove tag from contact', async ({ page }) => {
    await page.locator('[data-testid="contact-row"]').first().click();
    
    // If contact has tags
    const tagCount = await page.locator('[data-testid^="tag-"]').count();
    
    if (tagCount > 0) {
      await page.locator('[data-testid^="remove-tag-"]').first().click();
      
      // Tag count should decrease
      const newTagCount = await page.locator('[data-testid^="tag-"]').count();
      expect(newTagCount).toBe(tagCount - 1);
    }
  });

  test('should view contact conversation history', async ({ page }) => {
    await page.locator('[data-testid="contact-row"]').first().click();
    
    await page.click('[data-testid="conversation-history-tab"]');
    
    await expect(page.locator('[data-testid="conversation-history"]')).toBeVisible();
  });

  test('should bulk select contacts', async ({ page }) => {
    await page.click('[data-testid="select-all-checkbox"]');
    
    // All checkboxes should be checked
    const checkboxes = page.locator('[data-testid="contact-checkbox"]');
    const count = await checkboxes.count();
    
    for (let i = 0; i < count; i++) {
      await expect(checkboxes.nth(i)).toBeChecked();
    }
  });

  test('should bulk delete contacts', async ({ page }) => {
    await page.locator('[data-testid="contact-checkbox"]').first().check();
    await page.locator('[data-testid="contact-checkbox"]').nth(1).check();
    
    await page.click('[data-testid="bulk-delete-button"]');
    await page.click('[data-testid="confirm-delete-button"]');
    
    // Should show success message
    await expect(page.locator('text=/contacts.*deleted|contatos.*excluídos/i')).toBeVisible();
  });

  test('should bulk add tags', async ({ page }) => {
    await page.locator('[data-testid="contact-checkbox"]').first().check();
    await page.locator('[data-testid="contact-checkbox"]').nth(1).check();
    
    await page.click('[data-testid="bulk-tag-button"]');
    await page.fill('[data-testid="tag-input"]', 'Bulk Tag');
    await page.click('[data-testid="apply-tag-button"]');
    
    // Should show success message
    await expect(page.locator('text=/tags.*added|tags.*adicionadas/i')).toBeVisible();
  });
});
