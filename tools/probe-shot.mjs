import { writeFileSync } from 'node:fs'

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
const send = (method, params = {}, ms = 8000) =>
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
  return r.result?.value
}
await send('Runtime.enable')
console.log('tab text:', (await evaluate('document.querySelector("h1")?.textContent')))
for (const fromSurface of [false, true]) {
  try {
    const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface, captureBeyondViewport: false })
    const buffer = Buffer.from(data, 'base64')
    writeFileSync(`shots-electron/probe-${fromSurface}.png`, buffer)
    console.log('surface', fromSurface, 'bytes', buffer.length)
  } catch (e) {
    console.log('surface', fromSurface, 'failed', e.message)
  }
}
ws.close()
