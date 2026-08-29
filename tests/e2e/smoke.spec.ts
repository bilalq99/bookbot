// End-to-end smoke against the built app (playwright.config.ts boots it on :3111
// with a fresh DB): register -> log a bench session -> publish -> feed card ->
// bump + comment on the detail page -> profile count -> logout/login.
import { expect, test } from '@playwright/test'

const suffix = Math.random().toString(36).slice(2, 8)
const USERNAME = `smoke_${suffix}`
const PASSWORD = 'password1'

test('register, log a session, publish, and interact with it', async ({ page }) => {
  test.setTimeout(120_000)

  // Visiting the app logged-out lands on /login.
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)

  // The public legal pages (App Store privacy/support URLs) render logged-out.
  await page.getByRole('link', { name: 'Privacy' }).click()
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible()
  await page.goto('/support')
  await expect(page.getByRole('heading', { name: 'Support' })).toBeVisible()
  await page.goto('/login')

  // Register a fresh user.
  await page.getByText('Create an account').click()
  await page.locator('input[autocomplete="username"]').fill(USERNAME)
  await page.locator('input[autocomplete="new-password"]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/$/)

  // Empty following feed nudges to discover.
  await expect(page.getByText("haven't posted yet")).toBeVisible()

  // Log a session: Bench Press, warmup 60x10 + 100x5 + 102.5x3.
  await page.goto('/log')
  await page.getByRole('button', { name: /Start empty/ }).click()
  await page.getByPlaceholder('Search exercises…').fill('bench press')
  await page.getByRole('button', { name: /^Bench Press/ }).first().click()

  const cells = page.locator('.log-set-input')
  await cells.nth(0).fill('60')
  await cells.nth(1).fill('10')
  // mark it a warm-up (first row starts as working set "1")
  await page.locator('.log-set-w').first().click()

  await page.getByRole('button', { name: '+ Add set' }).click()
  await cells.nth(3).fill('100')
  await cells.nth(4).fill('5')
  await page.getByRole('button', { name: '+ Add set' }).click()
  await cells.nth(6).fill('102.5')
  await cells.nth(7).fill('3')

  await page.getByRole('button', { name: 'Finish' }).click()
  await page.getByRole('button', { name: 'Post session' }).click()

  // First session on a new account: PR celebration, then the detail page.
  await expect(page.getByText(/new record/)).toBeVisible()
  await page.getByRole('button', { name: 'View session' }).click()
  await expect(page).toHaveURL(/\/s\/\d+$/)
  await expect(page.locator('.wk-tile-value').first()).toHaveText(/807|808/) // 100*5 + 102.5*3 = 807.5

  // Bump it and comment on it.
  await page.locator('.wk-bumps .feed-bump').click()
  await expect(page.locator('.wk-bumps .feed-bump .num')).toHaveText('1')
  await page.getByPlaceholder('Leave a comment…').fill('chalk up 🤜')
  await page.getByRole('button', { name: 'Post', exact: true }).click()
  await expect(page.getByText('chalk up 🤜')).toBeVisible()

  // The feed shows the session card with the volume on it.
  await page.goto('/')
  await expect(page.locator('.card-hero').first()).toBeVisible()
  await expect(page.locator('.card-stats').first()).toContainText(/808/)

  // Profile shows 1 session in the grid.
  await page.goto(`/@${USERNAME}`)
  await expect(page.locator('.pf-statsrow')).toContainText('1 Sessions')
  await expect(page.locator('.pf-cell')).toHaveCount(1)

  // Logout via settings, then log back in.
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.locator('input[autocomplete="username"]').fill(USERNAME)
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('.card-hero').first()).toBeVisible()
})
