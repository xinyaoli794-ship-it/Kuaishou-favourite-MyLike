import { app } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { demoCoverSvg, demoEntries } from '../../shared/demo-works'

/**
 * 演示素材协议：`mylike://demo/...`
 *
 * 真实版本里封面和视频来自快手 CDN（https）；演示包没有这些资源，
 * 就用协议直接从本地生成封面 / 读取测试片段，保证离线也能预览。
 */
const clipRoot = () =>
  app.isPackaged ? join(process.resourcesPath, 'clips') : join(app.getAppPath(), 'public', 'clips')

const svg = (body: string) =>
  new Response(body, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  })

const notFound = () => new Response('Not found', { status: 404 })

const avatar = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ff8a6b"/><stop offset="1" stop-color="#ff4d7d"/></linearGradient></defs>
<rect width="96" height="96" rx="48" fill="url(#a)"/>
<text x="48" y="60" font-size="40" text-anchor="middle" fill="#fff" font-family="sans-serif">快</text>
</svg>`

export async function demoResponse(url: URL, request: Request): Promise<Response> {
  if (url.pathname === '/avatar.svg') return svg(avatar)
  if (url.pathname.startsWith('/cover/')) {
    const index = Number(url.pathname.slice('/cover/'.length).replace(/\.svg$/, ''))
    if (!Number.isInteger(index) || index < 0) return notFound()
    return svg(demoCoverSvg(index % demoEntries.length))
  }
  if (url.pathname.startsWith('/clip/')) {
    const name = url.pathname.slice('/clip/'.length)
    if (!/^[a-z0-9-]+\.mp4$/i.test(name)) return notFound()
    let buffer: Buffer
    try {
      buffer = await readFile(join(clipRoot(), name))
    } catch {
      return notFound()
    }
    const headers: Record<string, string> = {
      'content-type': 'video/mp4',
      'accept-ranges': 'bytes',
      'cache-control': 'public, max-age=3600'
    }
    const range = request.headers.get('range')
    const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null
    if (match) {
      const start = match[1] ? Number(match[1]) : 0
      const end = match[2] ? Math.min(Number(match[2]), buffer.length - 1) : buffer.length - 1
      if (Number.isFinite(start) && start <= end) {
        const chunk = buffer.subarray(start, end + 1)
        return new Response(new Uint8Array(chunk), {
          status: 206,
          headers: {
            ...headers,
            'content-range': `bytes ${start}-${end}/${buffer.length}`,
            'content-length': String(chunk.length)
          }
        })
      }
    }
    return new Response(new Uint8Array(buffer), { headers })
  }
  return notFound()
}
