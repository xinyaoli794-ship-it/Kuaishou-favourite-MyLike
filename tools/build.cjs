/**
 * 受限环境下的构建入口：electron-vite 在 Windows 上会探测网络驱动器，
 * 该探测需要子进程管道；这里把它降级为空操作后再构建。
 * 正常环境直接使用 `npm run build`。
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
  const { build } = await import('electron-vite')
  await build({})
  console.log('build done')
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
