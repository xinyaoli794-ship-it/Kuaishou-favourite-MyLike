const urls = [
  'https://npmmirror.com/mirrors/electron/44.0.0/electron-v44.0.0-win32-x64.zip',
  'https://github.com/electron/electron/releases/download/v44.0.0/electron-v44.0.0-win32-x64.zip',
  'https://registry.npmmirror.com/-/binary/electron/44.0.0/electron-v44.0.0-win32-x64.zip'
]
for (const url of urls) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const r = await fetch(url, { method: 'GET', headers: { range: 'bytes=0-1023' }, signal: controller.signal })
    const buffer = await r.arrayBuffer()
    console.log(r.status, r.headers.get('content-type'), buffer.byteLength, url)
  } catch (e) {
    console.log('ERR', e.name, e.message, url)
  } finally {
    clearTimeout(timer)
  }
}
