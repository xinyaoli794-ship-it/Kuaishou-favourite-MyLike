/** 通过 CDP 驱动无头 Edge，截取各页面用于预览。 */
import { writeFileSync, mkdirSync } from 'node:fs'

const outDir = new URL('../shots/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
mkdirSync(outDir, { recursive: true })

const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json()
const page = targets.find((t) => t.type === 'page' && t.url.includes('5178'))
if (!page) throw new Error('page target not found')

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
  if (message.method === 'Runtime.exceptionThrown') {
    problems.push('EXCEPTION ' + (message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text))
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    problems.push('CONSOLE ' + message.params.args.map((a) => a.value ?? a.description).join(' '))
  }
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result?.value
}
const shot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(`${outDir}${name}.png`, Buffer.from(data, 'base64'))
  console.log('saved', name)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false
})

await send('Page.navigate', { url: 'http://127.0.0.1:5178/' })
await sleep(2500)

console.log('title:', await evaluate('document.title'))
console.log('cards:', await evaluate("document.querySelectorAll('.work-card').length"))
console.log('nav:', await evaluate("[...document.querySelectorAll('.nav-item')].map(b=>b.textContent).join('|')"))
await shot('01-library')

await evaluate("[...document.querySelectorAll('.nav-item')].find(b=>b.textContent.includes('仪表盘')).click()")
await sleep(1400)
await shot('02-dashboard')

await evaluate("[...document.querySelectorAll('.nav-item')].find(b=>b.textContent.includes('收藏的内容')).click()")
await sleep(1400)
await shot('03-favorites')

await evaluate("[...document.querySelectorAll('.nav-item')].find(b=>b.textContent.includes('设置')).click()")
await sleep(1200)
await shot('04-settings')

await evaluate("[...document.querySelectorAll('.nav-item')].find(b=>b.textContent.includes('连接与任务')).click()")
await sleep(1200)
await shot('06-tasks')

await evaluate("window.mylike.invoke('theme',{theme:'light'})")
await sleep(600)
await evaluate("[...document.querySelectorAll('.nav-item')].find(b=>b.textContent.includes('仪表盘')).click()")
await sleep(1200)
await shot('07-light')

await evaluate("window.mylike.invoke('theme',{theme:'dark'})")
await sleep(400)
await evaluate("[...document.querySelectorAll('.nav-item')].find(b=>b.textContent.includes('喜欢的内容')).click()")
await sleep(1200)
await evaluate("document.querySelector('.work-card').click()")
await sleep(3500)
await shot('05-player')
console.log('player open:', await evaluate("!!document.querySelector('.player-shell.is-active')"))

if (problems.length) {
  console.log('--- page problems ---')
  console.log([...new Set(problems)].slice(0, 20).join('\n'))
} else {
  console.log('no console errors')
}
ws.close()
