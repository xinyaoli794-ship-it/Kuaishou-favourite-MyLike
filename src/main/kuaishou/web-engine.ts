import { app, BrowserWindow, session } from 'electron'
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EngineStatus } from '../../shared/contracts'
import type { RuntimeEventInput } from '../../shared/runtime-events'
import { AppError } from '../errors'
import type { AccessEvent, AccessTarget, Operation, PageState } from './access'
import type { PlatformEngine } from './engine-api'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

type Reply = { status: number; text: string }
type Photo = Record<string, any>

/**
 * 真实快手引擎（第一阶段：读取「赞过」）。
 *
 * 打开真实 kuaishou.com 窗口让用户扫码登录，并在页面主世界用页面自己的
 * 签名环境调用 `/rest/v/feed/liked`；不逆向算法、不保存密码。
 */
export class KuaishouWebEngine implements PlatformEngine {
  private win: BrowserWindow | null = null
  private accountId: string | null = null
  private status: EngineStatus = 'stopped'
  private interaction: 'login' | 'verification' | null = null
  private suppressed = false
  private observer: ((accountId: string, event: RuntimeEventInput) => void) | null = null
  private attention: ((event: AccessEvent) => void) | null = null
  private failedTarget: AccessTarget | null = null
  private target: AccessTarget = { operation: 'self', parameters: {} }
  private starting: Promise<BrowserWindow> | null = null
  private cache = new Map<string, { photo: Photo; author: Record<string, any> }>()
  private realmReady = false

  constructor(
    private readonly changed: () => void,
    private readonly parent: () => BrowserWindow | null
  ) {}

  snapshot() {
    return { status: this.status, accountId: this.accountId }
  }
  setObserver(observer: ((accountId: string, event: RuntimeEventInput) => void) | null) {
    this.observer = observer
  }
  setAttentionHandler(handler: ((event: AccessEvent) => void) | null) {
    this.attention = handler
  }
  setInteraction(kind: 'login' | 'verification' | null) {
    this.interaction = kind
  }
  allowAttention() {
    this.suppressed = false
  }
  recoveryTarget(accountId: string) {
    return this.accountId === accountId ? this.failedTarget : null
  }
  dismissAttention(accountId: string) {
    this.suppressed = true
    this.hide(accountId, false)
    this.attention?.({ type: 'closed', accountId })
  }
  requireAttention(accountId: string, kind: 'login' | 'verification', target = this.target) {
    if (!this.suppressed) this.attention?.({ type: 'required', accountId, kind, target })
  }
  cancelRecovery() {}
  cancel() {}

  private partition(accountId: string) {
    return session.fromPartition(`persist:ks-${accountId}`)
  }

  private log(message: string) {
    try {
      appendFileSync(join(app.getPath('userData'), 'ks-engine.log'), `${new Date().toISOString()} ${message}\n`)
    } catch {
      /* 日志失败不影响主流程 */
    }
  }

  private async ensure(accountId: string): Promise<BrowserWindow> {
    if (this.win && !this.win.isDestroyed() && this.accountId === accountId) return this.win
    if (this.starting) return this.starting
    this.starting = this.open(accountId).finally(() => {
      this.starting = null
    })
    return this.starting
  }

  private async open(accountId: string): Promise<BrowserWindow> {
    this.destroy(false)
    this.accountId = accountId
    this.status = 'starting'
    this.changed()
    const part = this.partition(accountId)
    part.setUserAgent(UA)
    const win = new BrowserWindow({
      width: 1180,
      height: 820,
      minWidth: 900,
      minHeight: 640,
      show: false,
      title: '快手登录',
      parent: this.parent() ?? undefined,
      autoHideMenuBar: true,
      backgroundColor: '#111114',
      webPreferences: {
        session: part,
        // 登录窗口需要捕获页面内置签名环境，因此关闭世界隔离；仍保持 sandbox、
        // 不开放 Node，也不允许导航到快手之外的站点。
        contextIsolation: false,
        nodeIntegration: false,
        sandbox: true,
        preload: join(__dirname, '../preload/ks.cjs')
      }
    })
    this.win = win
    win.on('closed', () => {
      if (this.win !== win) return
      const closed = this.accountId
      this.win = null
      this.status = 'stopped'
      this.accountId = null
      this.realmReady = false
      this.changed()
      if (closed) this.attention?.({ type: 'closed', accountId: closed })
    })
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    // 不等待整页加载完成：快手首页资源很多，先让窗口可见，签名环境稍后就绪。
    void win.loadURL('https://www.kuaishou.com/new-reco').catch((error) => {
      this.log(`load failed: ${error instanceof Error ? error.message : String(error)}`)
    })
    this.status = 'ready'
    this.changed()
    return win
  }

  /** 等待页面签名环境就绪；必要时重载一次。 */
  private async ensureRealm(win: BrowserWindow): Promise<void> {
    if (this.realmReady) return
    const ready = async () => {
      try {
        return (await win.webContents.executeJavaScript('!!window.__ks_realm')) === true
      } catch {
        return false
      }
    }
    for (let i = 0; i < 16; i++) {
      if (await ready()) {
        this.realmReady = true
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    await win.webContents.reload()
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      if (await ready()) {
        this.realmReady = true
        return
      }
    }
    throw new AppError('PAGE_CHANGED', '快手页面还没准备好，请稍后重试。')
  }

  private destroy(notify = true) {
    const win = this.win
    const accountId = this.accountId
    this.win = null
    this.accountId = null
    this.status = 'stopped'
    this.realmReady = false

    if (win && !win.isDestroyed()) win.destroy()
    this.changed()
    if (notify && accountId) this.attention?.({ type: 'closed', accountId })
  }

  async pageState(accountId: string): Promise<PageState> {
    const win = this.win
    if (!win || win.isDestroyed() || this.accountId !== accountId)
      return { ready: false, captcha: false }
    try {
      const state = await win.webContents.executeJavaScript(`(() => {
        const ready = !!document.body && ['interactive', 'complete'].includes(document.readyState)
        const text = document.body ? (document.body.innerText || '').slice(0, 4000) : ''
        const captcha = /拖动滑块|滑动验证|完成安全验证|请完成验证|安全验证/.test(text) ||
          !!document.querySelector('iframe[src*="captcha"], [class*="captcha-slider"], [class*="captcha_slider"]')
        return { ready: ready && location.hostname.endsWith('kuaishou.com'), captcha }
      })()`)
      return { ready: state?.ready === true, captcha: state?.captcha === true }
    } catch {
      return { ready: false, captcha: false }
    }
  }

  async show(accountId: string): Promise<void> {
    const win = await this.ensure(accountId)
    win.show()
    win.focus()
    this.status = 'visible'
    this.changed()
    this.report(accountId, { kind: 'auth', message: '已打开快手窗口，请在窗口里登录。' })
  }

  hide(accountId: string, _verified = true) {
    if (this.accountId !== accountId) return
    this.win?.hide()
    this.status = 'ready'
    this.interaction = null
    this.changed()
  }

  async request(
    accountId: string,
    operation: Operation,
    parameters: Record<string, string> = {},
    _options: { recovery?: boolean; loginCheck?: boolean } = {}
  ): Promise<Record<string, any>> {
    const win = await this.ensure(accountId)
    await this.ensureRealm(win)
    const started = Date.now()
    try {
      let data: Record<string, any>
      if (operation === 'self') data = await this.self(win, accountId)
      else if (operation === 'likes') data = await this.likes(win, parameters)
      else if (operation === 'detail') data = this.detail(parameters.aweme_id ?? '')
      else throw new AppError('WORK_UNAVAILABLE', '当前版本只支持读取「赞过」，收藏与写操作还没接入。')
      this.report(accountId, {
        kind: 'request',
        operation,
        responseType: 'list',
        status: 200,
        count: Array.isArray(data.aweme_list) ? data.aweme_list.length : undefined,
        durationMs: Date.now() - started,
        message: `快手接口返回${Array.isArray(data.aweme_list) ? ` · ${data.aweme_list.length} 条` : ''}`
      })
      return data
    } catch (error) {
      const detail = error instanceof AppError ? error : new AppError('NETWORK_ERROR', '请求快手失败。')
      this.report(accountId, {
        kind: 'request',
        operation,
        code: detail.code,
        message: detail.message,
        durationMs: Date.now() - started
      })
      throw detail
    }
  }

  private async self(win: BrowserWindow, accountId: string): Promise<Record<string, any>> {
    // 登录后「赞过」第一页能取到内容，就说明登录有效。
    const data = await this.likes(win, { max_cursor: '0' })
    if (!Array.isArray(data.aweme_list))
      throw new AppError('AUTH_REQUIRED', '请先在快手窗口登录。')
    const cookies = await this.partition(accountId).cookies.get({ url: 'https://www.kuaishou.com' })
    const raw = cookies.find((cookie) => /^(userid|user_id|uid)$/i.test(cookie.name))?.value ?? ''
    const remoteId = raw.replace(/[^A-Za-z0-9_-]/g, '')
    const nickname = await this.nickname(win)
    return {
      status_code: 0,
      user: {
        sec_uid: remoteId.length >= 8 ? remoteId : `ks_${remoteId || 'default'}`,
        nickname,
        avatar_thumb: { url_list: [] }
      }
    }
  }

  private async nickname(win: BrowserWindow): Promise<string> {
    try {
      const value = await win.webContents.executeJavaScript(`(() => {
        const selectors = ['.user-name', '[class*="user-name"]', '[class*="userName"]', '[class*="profile-name"]']
        for (const selector of selectors) {
          const node = document.querySelector(selector)
          const text = node && node.textContent ? node.textContent.trim() : ''
          if (text && text.length <= 40) return text
        }
        return ''
      })()`)
      if (typeof value === 'string' && value.trim()) return value.trim()
    } catch {
      /* 取不到昵称不影响采集 */
    }
    return '快手用户'
  }

  private async likes(
    win: BrowserWindow,
    parameters: Record<string, string>
  ): Promise<Record<string, any>> {
    const cursor =
      parameters.max_cursor && parameters.max_cursor !== '0' ? parameters.max_cursor : ''
    const reply = await this.signed(win, '/rest/v/feed/liked', { pcursor: cursor, page: 'profile' })
    const body = this.parse(reply)
    if (body.result !== 1) {
      if ([110, 203, 400].includes(Number(body.result)))
        throw new AppError('AUTH_REQUIRED', '请先在快手窗口登录。')
      if (Number(body.result) === 2) throw new AppError('RATE_LIMITED', '快手限流了，请稍后再试。')
      throw new AppError('API_REJECTED', `快手返回错误码 ${body.result}。`)
    }
    const feeds: any[] = Array.isArray(body.feeds) ? body.feeds : []
    const items = feeds.filter((feed) => feed?.photo?.id).map((feed) => this.aweme(feed))
    for (const feed of feeds) {
      if (feed?.photo?.id) this.cache.set(String(feed.photo.id), { photo: feed.photo, author: feed.author ?? {} })
    }
    const next = typeof body.pcursor === 'string' ? body.pcursor : ''
    const hasMore = next.length > 0 && feeds.length > 0
    return {
      status_code: 0,
      aweme_list: items,
      has_more: hasMore ? 1 : 0,
      max_cursor: hasMore ? next : '0'
    }
  }

  private detail(photoId: string): Record<string, any> {
    const cached = this.cache.get(photoId)
    if (!cached) throw new AppError('WORK_UNAVAILABLE', '没有这条作品的播放地址，请重新采集。')
    return { status_code: 0, aweme_detail: this.aweme({ photo: cached.photo, author: cached.author }) }
  }

  private aweme(feed: Record<string, any>): Record<string, any> {
    const photo = feed.photo ?? {}
    const author = feed.author ?? {}
    const covers = Array.isArray(photo.coverUrls) ? photo.coverUrls : []
    const cover = photo.coverUrl ?? covers[0]?.url ?? null
    const videos = (Array.isArray(photo.photoUrls) ? photo.photoUrls : [])
      .map((entry: any) => (typeof entry === 'string' ? entry : entry?.url))
      .filter((url: unknown): url is string => typeof url === 'string' && url.startsWith('https://'))
    const timestamp = Number(photo.timestamp ?? 0)
    return {
      aweme_id: String(photo.id),
      desc: typeof photo.caption === 'string' ? photo.caption : '',
      create_time: timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp,
      author: { nickname: typeof author.name === 'string' ? author.name : '' },
      user_digged: 1,
      collect_stat: 0,
      aweme_type: 0,
      video: {
        cover: { url_list: cover ? [cover] : [] },
        play_addr: { url_list: videos },
        duration: Number(photo.duration ?? 0)
      }
    }
  }

  /** 用页面内置的 $encode 生成 __NS_hxfalcon，再发签名请求。 */
  private async signed(win: BrowserWindow, path: string, body: Record<string, unknown>): Promise<Reply> {
    const script = `(async () => {
      const path = ${JSON.stringify(path)}
      const body = ${JSON.stringify(body)}
      try {
        const sign = await new Promise((resolve, reject) => {
          window.__ks_realm.call('$encode', [
            { url: path, query: { caver: 2 }, form: {}, requestBody: body },
            { suc: (value) => resolve(value), err: (error) => reject(new Error(String(error))) }
          ])
        })
        const response = await fetch('https://www.kuaishou.com' + path + '?__NS_hxfalcon=' + encodeURIComponent(sign) + '&caver=2', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', accept: '*/*' },
          body: JSON.stringify(body)
        })
        return JSON.stringify({ status: response.status, text: await response.text() })
      } catch (error) {
        return JSON.stringify({ status: 0, text: String(error) })
      }
    })()`
    const raw = await win.webContents.executeJavaScript(script)
    const reply = typeof raw === 'string' ? (JSON.parse(raw) as Reply) : (raw as Reply)
    this.log(`signed ${path} -> ${reply.status} ${reply.text.slice(0, 180)}`)
    if (reply.status === 401 || reply.status === 403)
      throw new AppError('AUTH_REQUIRED', '请先在快手窗口登录。')
    if (reply.status === 0) throw new AppError('NETWORK_ERROR', '请求快手失败，请稍后重试。')
    return reply
  }

  private parse(reply: Reply): Record<string, any> {
    try {
      const data = JSON.parse(reply.text)
      if (data && typeof data === 'object') return data
    } catch {
      /* 交给下面统一报错 */
    }
    throw new AppError('INVALID_RESPONSE', '快手返回了无法解析的内容。')
  }

  release(notify = true) {
    this.destroy(notify)
  }

  async logout(accountId: string): Promise<void> {
    try {
      const part = this.partition(accountId)
      await part.clearData()
      await part.clearAuthCache()
    } catch {
      throw new AppError('LOGOUT_FAILED', '登录状态清理失败，请重试。')
    }
  }

  async purgeAccount(accountId: string): Promise<void> {
    try {
      const part = this.partition(accountId)
      await part.closeAllConnections()
      await part.clearData()
      await part.clearAuthCache()
      await part.clearCache()
    } catch {
      throw new AppError('ACCOUNT_SESSION_PURGE_FAILED', '账号会话清理未完成，请稍后重试。')
    }
  }

  async clearCaches(accountId: string): Promise<void> {
    try {
      await this.partition(accountId).clearCache()
    } catch {
      throw new AppError('CACHE_CLEAR_FAILED', '缓存清理失败。')
    }
  }

  private report(accountId: string, event: RuntimeEventInput) {
    this.observer?.(accountId, event)
  }
}
