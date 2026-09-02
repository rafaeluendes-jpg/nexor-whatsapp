import { chromium } from 'playwright-core'
const out = process.argv[2]
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const erros = []
for (const [nome, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => erros.push(`${nome}: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') erros.push(`${nome} console: ${m.text()}`) })
  for (const rota of ['/entrar', '/criar-conta', '/esqueci-senha']) {
    await page.goto('http://localhost:4173' + rota, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${out}/${nome}${rota.replace(/\//g, '-')}.png`, fullPage: true })
  }
  await ctx.close()
}
await browser.close()
console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'sem erros de JS')
