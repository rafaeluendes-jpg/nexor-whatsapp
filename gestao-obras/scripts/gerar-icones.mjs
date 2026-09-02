import { chromium } from 'playwright-core'
import fs from 'node:fs'
const svg = fs.readFileSync(process.argv[2], 'utf8')
const out = process.argv[3]
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 })
for (const [name, size, pad] of [['icon-512.png', 512, 0], ['icon-192.png', 192, 0], ['icon-512-maskable.png', 512, 64], ['apple-touch-icon.png', 180, 0]]) {
  await page.setViewportSize({ width: size, height: size })
  const html = `<html><body style="margin:0;background:${pad ? '#0b1220' : 'transparent'};display:grid;place-items:center;width:${size}px;height:${size}px"><div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${svg.replace('width="512" height="512"', 'width="100%" height="100%"')}</div></body></html>`
  await page.setContent(html)
  await page.screenshot({ path: `${out}/${name}`, omitBackground: !pad })
}
await browser.close()
