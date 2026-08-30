// Generates the App Store screenshot sets from a running, seeded Chalk server.
//
//   npm run build && DB_PATH=... npm run seed -- --force
//   DB_PATH=... PORT=3211 node dist/server/index.js &
//   BASE_URL=http://localhost:3211 node scripts/appstore-screenshots.cjs
//
// Output: appstore/screenshots/iphone-6.9 (1320x2868) and iphone-6.7 (1290x2796),
// the sizes App Store Connect accepts for the required iPhone slot.
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright-core')

const BASE_URL = process.env.BASE_URL || 'http://localhost:3211'
const OUT_ROOT = path.resolve(__dirname, '..', 'appstore', 'screenshots')
const USER = process.env.SHOT_USER || 'demo'
const PASS = process.env.SHOT_PASS || 'demo1234'

// Logical viewport x3 = App Store pixel sizes.
const SIZES = [
  { name: 'iphone-6.9', width: 440, height: 956 },
  { name: 'iphone-6.7', width: 430, height: 932 },
]

async function capture(page, dir, file) {
  await page.waitForTimeout(600) // let images/gradients settle
  await page.screenshot({ path: path.join(dir, file) })
  console.log('  ✓', file)
}

async function run() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  for (const size of SIZES) {
    const dir = path.join(OUT_ROOT, size.name)
    fs.mkdirSync(dir, { recursive: true })
    console.log(`${size.name} (${size.width * 3}x${size.height * 3})`)
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()

    // Log in through the real UI.
    await page.goto(`${BASE_URL}/login`)
    await page.locator('input[autocomplete="username"]').fill(USER)
    await page.locator('input[autocomplete="current-password"]').fill(PASS)
    await page.getByRole('button', { name: 'Log in' }).click()
    await page.waitForSelector('.feed-cardlink')

    // 1. The feed.
    await capture(page, dir, '01-feed.png')

    // 2. A session detail page (first card in the feed).
    const href = await page.locator('.feed-cardlink').first().getAttribute('href')
    await page.goto(`${BASE_URL}${href}`)
    await page.waitForSelector('.wk-tile-value')
    await capture(page, dir, '02-session.png')

    // 3. The logging flow, mid-session.
    await page.goto(`${BASE_URL}/log`)
    await page.getByRole('button', { name: /Start empty/ }).click()
    await page.getByPlaceholder('Search exercises…').fill('bench press')
    await page.getByRole('button', { name: /^Bench Press/ }).first().click()
    const cells = page.locator('.log-set-input')
    await cells.nth(0).fill('100')
    await cells.nth(1).fill('5')
    await page.getByRole('button', { name: '+ Add set' }).click()
    await cells.nth(3).fill('102.5')
    await cells.nth(4).fill('3')
    await page.getByRole('button', { name: '+ Add set' }).click()
    await cells.nth(6).fill('105')
    await cells.nth(7).fill('1')
    await page.keyboard.press('Tab') // commit the last cell
    await capture(page, dir, '03-log.png')

    // 4. Records.
    await page.goto(`${BASE_URL}/records`)
    await page.waitForSelector('.page-title')
    await capture(page, dir, '04-records.png')

    // 5. A busy athlete profile.
    await page.goto(`${BASE_URL}/@sarah_squats`)
    await page.waitForSelector('.page-title, .profile-name, h1', { timeout: 10_000 })
    await capture(page, dir, '05-profile.png')

    // 6. Notifications (fall back to Discover if the inbox is empty).
    await page.goto(`${BASE_URL}/notifications`)
    const hasNotifs = await page
      .waitForSelector('.ntf-row', { timeout: 4000 })
      .then(() => true)
      .catch(() => false)
    if (hasNotifs) {
      await capture(page, dir, '06-notifications.png')
    } else {
      await page.goto(`${BASE_URL}/discover`)
      await page.waitForSelector('.page-title')
      await capture(page, dir, '06-discover.png')
    }

    await context.close()
  }
  await browser.close()
  console.log('done →', OUT_ROOT)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
