const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json()
const page = targets.find((t) => t.type === 'page' && t.url.includes('5178'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
const pending = new Map()
const problems = []
let seq = 0
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id)
    pending.delete(m.id)
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
    return
  }
  if (m.method === 'Runtime.exceptionThrown') problems.push(m.params.exceptionDetails.text)
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    problems.push(m.params.args.map((a) => a.value ?? a.description).join(' '))
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
  if (r.exceptionDetails) return 'THREW: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  return r.result?.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: 'http://127.0.0.1:5178/' })
await sleep(2200)

const caption = () => evaluate("document.querySelector('.list-caption span')?.textContent")

console.log('initial:', await caption(), 'cards:', await evaluate("document.querySelectorAll('.work-card').length"))

await evaluate(`(() => {
  const el = document.querySelector('input[placeholder="搜索标题或作者"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, '海边');
  el.dispatchEvent(new Event('input', { bubbles: true }));
})()`)
await sleep(900)
console.log('search 海边:', await caption())

await evaluate(`(() => {
  const el = document.querySelector('input[placeholder="搜索标题或作者"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, '');
  el.dispatchEvent(new Event('input', { bubbles: true }));
})()`)
await sleep(700)
await evaluate("[...document.querySelectorAll('.segmented button')].find(b=>b.textContent==='图集').click()")
await sleep(700)
console.log('gallery filter:', await caption())

await evaluate("[...document.querySelectorAll('.segmented button')].find(b=>b.textContent==='全部内容').click()")
await sleep(700)
await evaluate("document.querySelector('.list-actions button:last-child').click()")
await sleep(500)
console.log('selection bar:', await evaluate("document.querySelector('.batch-bar strong')?.textContent"))
await evaluate("[...document.querySelectorAll('.batch-bar button')].find(b=>b.textContent.includes('退出'))?.click()")
await sleep(300)

await evaluate("document.querySelector('.page-header .primary').click()")
await sleep(1200)
console.log('collecting:', await evaluate("document.querySelector('.page-header .primary')?.textContent.trim()"))
await sleep(3400)
console.log('after collect:', await caption(), '| notice:', await evaluate("document.querySelector('.notice')?.textContent?.slice(0,40)"))

await evaluate("[...document.querySelectorAll('.nav-item')].find(b=>b.textContent.includes('收藏的内容')).click()")
await sleep(900)
console.log('favorites:', await caption())
await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('同步收藏'))?.click()")
await sleep(2800)
console.log('favorites after sync:', await caption())

await evaluate("[...document.querySelectorAll('.nav-item')].find(b=>b.textContent.includes('设置')).click()")
await sleep(700)
await evaluate(`(() => {
  const el = document.querySelector('input[placeholder="搜索设置"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, '快捷键');
  el.dispatchEvent(new Event('input', { bubbles: true }));
})()`)
await sleep(600)
console.log('settings search results:', await evaluate("document.querySelectorAll('.settings-section').length"))

console.log(problems.length ? 'PROBLEMS:\n' + [...new Set(problems)].join('\n') : 'no console errors')
ws.close()
