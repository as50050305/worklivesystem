// 由 scripts/icon*.svg 產生 PWA 圖示 PNG：npm run icons（需要 playwright）
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const jobs = [
  ['scripts/icon.svg', 'public/pwa-192.png', 192],
  ['scripts/icon.svg', 'public/pwa-512.png', 512],
  ['scripts/icon-maskable.svg', 'public/pwa-maskable-512.png', 512],
  ['scripts/icon-apple.svg', 'public/apple-touch-icon.png', 180],
]
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [src, out, size] of jobs) {
  const svg = readFileSync(src, 'utf8')
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace(/width="512" height="512"/, `width="${size}" height="${size}"`)}</body></html>`,
  )
  await page.locator('svg').screenshot({ path: out, omitBackground: true })
  console.log('✓', out)
}
await browser.close()
