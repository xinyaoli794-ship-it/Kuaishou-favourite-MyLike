/**
 * 本地预览启动器（仅用于当前受限环境）。
 *
 * 这个环境禁止子进程管道通信，而 Vite 在 Windows 上会执行一次 `net use`
 * 来探测网络驱动器，导致启动失败。这里把该探测降级为空操作，其余行为不变。
 * 正常运行 `npm run dev` 时不需要这个文件。
 */
const cp = require('node:child_process')

const fake = (command, options, callback) => {
  const cb = typeof options === 'function' ? options : callback
  if (cb) process.nextTick(() => cb(null, '', ''))
  return { on() {}, once() {}, kill() {}, stdout: null, stderr: null }
}
cp.exec = fake
cp.execFile = fake

;(async () => {
  const { createServer } = await import('vite')
  const server = await createServer({
    server: { host: '127.0.0.1', port: 5178, strictPort: true }
  })
  await server.listen()
  server.printUrls()
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
