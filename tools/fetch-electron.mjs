import { mkdirSync, statSync, writeFileSync } from 'node:fs'

const version = '44.0.0'
const sources = [
  `https://registry.npmmirror.com/-/binary/electron/${version}/electron-v${version}-win32-x64.zip`,
  `https://github.com/electron/electron/releases/download/v${version}/electron-v${version}-win32-x64.zip`
]
const dir = new URL('../.electron-cache/', import.meta.url)
mkdirSync(dir, { recursive: true })
const dest = new URL(`electron-v${version}-win32-x64.zip`, dir)

for (const url of sources) {
  console.log('trying', url)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 240_000)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length < 50 * 1024 * 1024) throw new Error(`too small: ${buffer.length}`)
    writeFileSync(dest, buffer)
    console.log('saved', statSync(dest).size)
    process.exit(0)
  } catch (error) {
    console.log('failed', error.name, error.message)
  }
}
process.exit(1)
