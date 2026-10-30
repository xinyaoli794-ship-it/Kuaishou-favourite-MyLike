/** 桌面版端到端验证：建账号 → 自动核验 → 采集 → 截图。 */
import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = Number(process.env.CDP_PORT ?? 9333)
const outDir = new URL('../shots-electron/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
mkdirSync(outDir, { recursive: true })

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
if (!page) throw new Error('no page target')

const ws = new WebSocket(page.webSocketDebuggerUrl)
const pending = new Map()
const problems = []
let seq = 0
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result)
    return
  }
  if (message.method === 'Runtime.exceptionThrown')
    problems.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error')
    problems.push(message.params.args.map((a) => a.value ?? a.description).join(' '))
})
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true })
  ws.addEventListener('error', reject, { once: true })
})

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  return r.result?.value
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const shot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(`${outDir}${name}.png`, Buffer.from(data, 'base64'))
  console.log('shot', name)
}
const click = (text) =>
  evaluate(`(() => {
    const el = [...document.querySelectorAll('button')].find((node) => (node.textContent || '').includes(${JSON.stringify(text)}));
    if (!el) return 'MISS ' + ${JSON.stringify(text)};
    el.click();
    return 'ok ' + (el.textContent || '').trim().slice(0, 16);
  })()`)
const text = async () => (await evaluate('document.body.innerText')).replace(/\s+/g, ' ')

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: 'mylike://ui/index.html' })
await sleep(1500)
console.log('start:', (await text()).slice(0, 160))

const state = await evaluate(
  `(async () => { const s = await window.mylike.invoke('snapshot', {}); return JSON.stringify({ accounts: s.data?.accounts?.length, verified: s.data?.accounts?.[0]?.lastVerifiedAt, total: s.data?.collection }) })()`
)
console.log('snapshot:', state)

if (JSON.parse(state).accounts === 0) {
  console.log('add:', await click('添加第一个账号'))
  await sleep(500)
  await evaluate(`(() => {
    const input = [...document.querySelectorAll('input')].find((i) => i.placeholder.includes('我的快手'));
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '我的快手');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return 'typed';
  })()`)
  await sleep(200)
  console.log('create:', await click('创建账号'))
  await sleep(1200)
}

console.log('after create:', (await text()).slice(0, 200))
const login = await click('打开快手登录')
console.log('login:', login.startsWith('MISS') ? await click('登录') : login)
await sleep(4000)
console.log('after login:', (await text()).slice(0, 240))
await shot('01-library-empty')

const start = await click('自动采集')
console.log('collect:', start)
for (let i = 0; i < 15; i++) {
  await sleep(1000)
  const info = JSON.parse(
    await evaluate(
      `JSON.stringify({ cards: document.querySelectorAll('.work-card').length, label: document.querySelector('.list-caption span')?.textContent, button: document.querySelector('.page-header .primary')?.textContent?.trim() })`
    )
  )
  console.log('collect', i, JSON.stringify(info))
  if (info.cards > 0 && info.button === '自动采集') break
}
await shot('02-library')

console.log('dashboard:', await click('仪表盘'))
await sleep(1400)
await shot('03-dashboard')

console.log('favorites:', await click('收藏的内容'))
await sleep(1400)
console.log('favorites body:', (await text()).slice(0, 160))
await shot('04-favorites')

console.log('back:', await click('喜欢的内容'))
await sleep(1200)
await evaluate("document.querySelector('.work-card')?.click()")
await sleep(2600)
await shot('05-player')
console.log('player open:', await evaluate("!!document.querySelector('.player-shell.is-active')"))

console.log(problems.length ? 'PROBLEMS:\n' + [...new Set(problems)].slice(0, 10).join('\n') : 'no console errors')
ws.close()
