import type { BrowserWindow } from 'electron'
import type { EngineStatus } from '../../shared/contracts'
import type { RuntimeEventInput } from '../../shared/runtime-events'
import { demoClipName, demoEntries, demoFolderIds, demoPublishedAt, demoWorkId } from '../../shared/demo-works'
import { AppError } from '../errors'
import type { AccessEvent, AccessTarget, Operation, PageState } from './access'
import type { PlatformEngine } from './engine-api'

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const PAGE = 18

/**
 * 演示引擎。
 *
 * 真实的快手引擎会在登录窗口里注入 `visionProfileLikePhotoList` 等请求；
 * 这一版还没有接平台，只按同一套返回结构生成演示数据，让采集、入库、
 * 播放、收藏、取消点赞的完整链路可以跑通。
 *
 * 返回结构沿用现有解析器（`parse.ts`）的字段约定；接入快手真实接口时，
 * 只需替换本文件与 `parse.ts`。
 */
export class KuaishouEngine implements PlatformEngine {
  private accountId: string | null = null
  private status: EngineStatus = 'stopped'
  private observer: ((accountId: string, event: RuntimeEventInput) => void) | null = null
  private attention: ((event: AccessEvent) => void) | null = null
  private interaction: 'login' | 'verification' | null = null
  private suppressed = false
  private target: AccessTarget = { operation: 'self', parameters: {} }
  private failedTarget: AccessTarget | null = null
  private releaseMark = 0
  private writeEpoch = 0

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
  cancelRecovery(_accountId: string) {}

  async pageState(_accountId: string): Promise<PageState> {
    // 演示环境没有真实页面，始终视为就绪、无验证码。
    return { ready: true, captcha: false }
  }

  async show(accountId: string): Promise<void> {
    const mark = ++this.releaseMark
    this.accountId = accountId
    this.status = 'starting'
    this.changed()
    await pause(220)
    if (mark !== this.releaseMark) throw new AppError('CANCELLED', '打开窗口已取消。')
    this.status = 'visible'
    this.changed()
    this.report(accountId, {
      kind: 'auth',
      message: '演示模式：无需扫码，身份将自动核验。'
    })
  }

  hide(accountId: string, _verified = true) {
    if (this.accountId !== accountId) return
    this.status = 'ready'
    this.interaction = null
    this.changed()
  }

  async request(
    accountId: string,
    operation: Operation,
    parameters: Record<string, string> = {},
    options: { recovery?: boolean; loginCheck?: boolean } = {}
  ): Promise<Record<string, any>> {
    // 登录/验证进行中时，只有身份核验（recovery）可以继续；业务请求一律拒绝，
    // 由上层提示用户先完成登录——与真实引擎的行为保持一致。
    if (this.interaction && !options.recovery) {
      throw new AppError(
        this.interaction === 'login' ? 'AUTH_REQUIRED' : 'VERIFICATION_REQUIRED',
        '演示模式：请先完成登录。'
      )
    }
    this.accountId = accountId
    await pause(90)
    const started = Date.now()
    const data = respond(operation, parameters)
    const count = Array.isArray(data.aweme_list) ? data.aweme_list.length : undefined
    this.report(accountId, {
      kind: 'request',
      operation,
      responseType: 'list',
      status: 200,
      count,
      durationMs: Date.now() - started,
      message: `演示响应${count === undefined ? '' : ` · ${count} 条`}`
    })
    return data
  }

  cancel() {}
  release(notify = true) {
    this.releaseMark++
    const accountId = this.accountId
    this.accountId = null
    this.status = 'stopped'
    this.interaction = null
    this.suppressed = false
    this.failedTarget = null
    this.writeEpoch++
    if (accountId && notify) this.attention?.({ type: 'closed', accountId })
    this.changed()
  }
  async logout(_accountId: string) {}
  async purgeAccount(_accountId: string) {}
  async clearCaches(_accountId: string) {}

  private report(accountId: string, event: RuntimeEventInput) {
    this.observer?.(accountId, event)
  }
}

function identity(accountId: string) {
  const suffix = accountId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'demo'
  return {
    user: {
      uid: '1000001',
      sec_uid: `MS4wLjABAAAA${suffix}`,
      nickname: '快看小王',
      unique_id: 'kuaikan_xiaowang',
      avatar_thumb: { url_list: ['mylike://demo/avatar.svg'] }
    }
  }
}

function aweme(index: number) {
  const [title, author, mediaType] = demoEntries[index]
  const cover = `mylike://demo/cover/${index}.svg`
  const folders = demoFolderIds(index)
  const base: Record<string, any> = {
    aweme_id: demoWorkId(index),
    desc: title,
    create_time: demoPublishedAt(index),
    author: { nickname: author, uid: String(2000 + index) },
    statistics: { digg_count: 1200 + index * 37, comment_count: index * 5 },
    user_digged: 1,
    collect_stat: folders.length ? 1 : 0,
    aweme_type: 0,
    video: {
      cover: { url_list: [cover] },
      origin_cover: { url_list: [cover] },
      play_addr: { url_list: [`mylike://demo/clip/${demoClipName(index)}.mp4`] },
      duration: 18_000
    }
  }
  if (mediaType === 'gallery') {
    base.images = [0, 1, 2].map((offset) => ({
      url_list: [`mylike://demo/cover/${(index + offset * 7) % demoEntries.length}.svg`]
    }))
    delete base.video
  }
  return base
}

const all = () => demoEntries.map((_, index) => index)
const liked = () => all().filter((index) => !demoFolderIds(index).length)
const favorite = () => all().filter((index) => demoFolderIds(index).length)

/** 收藏夹 id 必须是数字串，解析器与数据库都按这个约定走。 */
const FOLDER_IDS: Record<string, string> = { 'f-all': '1001', 'f-food': '1002', 'f-travel': '1003' }

function folderOf(index: number): string {
  return FOLDER_IDS[demoFolderIds(index)[0] ?? 'f-all'] ?? '1001'
}

function page(list: number[], parameters: Record<string, string>) {
  const offset = Number(parameters.max_cursor || parameters.cursor || '0') || 0
  const size = Number(parameters.count || PAGE) || PAGE
  const slice = list.slice(offset, offset + size)
  const next = offset + slice.length
  const hasMore = next < list.length
  return {
    aweme_list: slice.map(aweme),
    has_more: hasMore ? 1 : 0,
    max_cursor: String(next),
    cursor: String(next),
    status_code: 0
  }
}

function respond(operation: Operation, parameters: Record<string, string>): Record<string, any> {
  switch (operation) {
    case 'self':
      return { status_code: 0, ...identity('demo') }
    case 'likes':
      return page(liked(), parameters)
    case 'favorites':
      return page(favorite(), parameters)
    case 'folderItems': {
      const folder = parameters.collects_id ?? parameters.folder_id ?? ''
      return page(
        favorite().filter((index) => folderOf(index) === folder),
        parameters
      )
    }
    case 'folders':
      return {
        status_code: 0,
        has_more: 0,
        cursor: '0',
        collects_list: [
          { collects_id: '1001', collects_name: '默认收藏', aweme_count: 5, status: 0 },
          { collects_id: '1002', collects_name: '深夜食堂', aweme_count: 4, status: 1 },
          { collects_id: '1003', collects_name: '想去的地方', aweme_count: 0, status: 1 }
        ]
      }
    case 'detail': {
      const id = parameters.aweme_id ?? ''
      const index = all().find((item) => demoWorkId(item) === id)
      if (index === undefined) throw new AppError('WORK_UNAVAILABLE', '演示数据中没有这条作品。')
      return { status_code: 0, aweme_detail: aweme(index) }
    }
    case 'favoriteFolderCreate':
      return {
        status_code: 0,
        collects_info: {
          collects_id: String(Date.now()),
          collects_name: parameters.collects_name ?? '新建收藏夹',
          aweme_count: 0,
          status: parameters.secret === '1' ? 1 : 0
        }
      }
    case 'unlike':
    case 'favoriteAdd':
    case 'favoriteRemove':
    case 'favoriteFolderAdd':
      return { status_code: 0 }
    default:
      return { status_code: 0 }
  }
}
