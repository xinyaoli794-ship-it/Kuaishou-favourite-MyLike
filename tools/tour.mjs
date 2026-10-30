/** 依次切换页面并截图（桌面版，通过 CDP）。 */
import { mkdirSync, writeFileSync } from 'node:fs'

const outDir = new URL('../shots-electron/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
mkdirSync(outDir, { recursive: true })

const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json()
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
const pending = new Map()
let seq = 0
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id)
    pending.delete(m.id)
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result)
  }
})
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
const send = (method, params = {}, ms = 20000) =>
  Promise.race([
    new Promise((resolve, reject) => {
      const id = ++seq
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout ' + method)), ms))
  ])
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text)
  return r.result?.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shot = async (name) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data } = await send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false
      })
      const buffer = Buffer.from(data, 'base64')
      if (buffer.length < 5000) throw new Error('blank capture')
      writeFileSync(`${outDir}${name}.png`, buffer)
      console.log('shot', name, buffer.length)
      return
    } catch (error) {
      console.log('retry', name, error.message)
      await sleep(800)
    }
  }
}
const click = (text) =>
  evaluate(`(() => {
    const el = [...document.querySelectorAll('button')].find((node) => (node.textContent || '').includes(${JSON.stringify(text)}));
    if (!el) return 'MISS ' + ${JSON.stringify(text)};
    el.click();
    return 'ok';
  })()`)

await send('Runtime.enable')
console.log('nav:', await click('仪表盘'))
await sleep(1500)
await shot('03-dashboard')

console.log('nav:', await click('收藏的内容'))
await sleep(1500)
await shot('04-favorites')

console.log('nav:', await click('连接与任务'))
await sleep(1200)
await shot('06-tasks')

console.log('nav:', await click('喜欢的内容'))
await sleep(1500)
await shot('02-library')

await evaluate("document.querySelector('.work-card')?.click()")
await sleep(3000)
await shot('05-player')
console.log('player:', await evaluate("!!document.querySelector('.player-shell.is-active')"))
console.log('cards:', await evaluate("document.querySelectorAll('.work-card').length"))
ws.close()
