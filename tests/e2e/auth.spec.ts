import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Authentication Flow
 * 
 * Tests the complete authentication flow including:
 * - Login
 * - Logout
 * - Signup
 * - Password reset
 * - Session persistence
 */

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page).toHaveTitle(/Login|PrimeZap/i);
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.goto('/login');
    
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=/email.*required/i')).toBeVisible();
    await expect(page.locator('text=/password.*required/i')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=/invalid.*credentials/i')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', process.env.E2E_TEST_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Should show user info
    await expect(page.locator('text=/welcome|dashboard/i')).toBeVisible();
  });

  test('should persist session after page reload', async ({ page, context }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.E2E_TEST_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Reload page
    await page.reload();
    
    // Should still be on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('text=/welcome|dashboard/i')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.E2E_TEST_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('text=/logout|sair/i');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should display signup page', async ({ page }) => {
    await page.goto('/signup');
    
    await expect(page).toHaveTitle(/Sign Up|Cadastro|PrimeZap/i);
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('should validate password strength', async ({ page }) => {
    await page.goto('/signup');
    
    await page.fill('input[name="password"]', '123');
    
    await expect(page.locator('text=/weak|fraca/i')).toBeVisible();
    
    await page.fill('input[name="password"]', 'StrongP@ssw0rd');
    
    await expect(page.locator('text=/strong|forte/i')).toBeVisible();
  });

  test('should navigate to password reset page', async ({ page }) => {
    await page.goto('/login');
    
    await page.click('text=/forgot.*password|esqueceu.*senha/i');
    
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('should send password reset email', async ({ page }) => {
    await page.goto('/forgot-password');
    
    await page.fill('input[name="email"]', 'test@example.com');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=/email.*sent|email.*enviado/i')).toBeVisible();
  });

  test('should redirect to login if not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect to dashboard if already authenticated', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.E2E_TEST_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Try to go to login again
    await page.goto('/login');
    
    // Should redirect back to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
