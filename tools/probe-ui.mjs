const PORT = Number(process.env.CDP_PORT ?? 9333)
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
const pending = new Map()
let seq = 0
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id)
    pending.delete(m.id)
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
  }
})
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) return 'THREW ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  return r.result?.value
}
await send('Runtime.enable')
console.log('buttons:', await evaluate("[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).join(' | ')"))
console.log('primary:', await evaluate("document.querySelector('.primary')?.textContent"))
console.log(
  'html:',
  (await evaluate("document.querySelector('.main-area')?.innerHTML"))?.slice(0, 600)
)
ws.close()
