import type {
  Account,
  CollectionTask,
  DesktopAPI,
  FavoriteFolder,
  LibraryOverview,
  Media,
  Outputs,
  QueueState,
  Snapshot,
  Work
} from '../../../shared/contracts'
import { appPreferencesSchema, playbackPreferencesSchema } from '../../../shared/preferences'
import { demoClips, seedFolders, seedWorks, type SeedWork } from './data'

const uid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })

const now = () => Date.now()
const clone = <T,>(value: T): T => structuredClone(value)

const account: Account = {
  id: uid(),
  name: '我的快手',
  remoteId: '3x7d9k2m1p',
  nickname: '快看小王',
  avatarUrl: null,
  createdAt: now() - 86400_000 * 30,
  lastVerifiedAt: now() - 3600_000
}

type State = {
  accounts: Account[]
  activeAccountId: string
  theme: 'dark' | 'light'
  works: SeedWork[]
  folders: FavoriteFolder[]
  playback: QueueState | null
  playbackPrefs: ReturnType<typeof playbackPreferencesSchema.parse>
  appPrefs: ReturnType<typeof appPreferencesSchema.parse>
  revision: number
  collection: CollectionTask | null
  favorites: Snapshot['favorites']
  unlike: Snapshot['unlike']
  busy: boolean
  auth: Snapshot['authentication']
  events: Outputs['runtimeEvents']
}

const state: State = {
  accounts: [account],
  activeAccountId: account.id,
  theme: 'dark',
  works: clone(seedWorks),
  folders: clone(seedFolders),
  playback: null,
  playbackPrefs: playbackPreferencesSchema.parse({}),
  appPrefs: appPreferencesSchema.parse({}),
  revision: 1,
  collection: null,
  favorites: null,
  unlike: null,
  busy: false,
  auth: null,
  events: [
    event('engine', '演示模式：界面数据来自本地样例，未连接快手。'),
    event('task', '喜欢列表已收录 42 条，末尾已确认。', { code: 'END_CONFIRMED', count: 42 }),
    event('request', '喜欢列表 · 第 3 页 · 200 · 18 条', { operation: 'likes', status: 200, count: 18 }),
    event('request', '身份核验 · 200 · 快看小王', { operation: 'self', status: 200 })
  ]
}

function event(
  kind: State['events'][number]['kind'],
  message: string,
  extra: Partial<State['events'][number]> = {}
): State['events'][number] {
  return { id: uid(), time: now(), kind, message, ...extra }
}

const listeners = new Set<() => void>()
const emit = () => {
  state.revision++
  for (const listener of listeners) listener()
}

const activeWorks = () => state.works.filter((work) => work.source === 'likes')
const accountById = (id: string) => state.accounts.find((item) => item.id === id)

function deepLink(work: SeedWork) {
  return `https://www.kuaishou.com/short-video/${work.id}`
}

function snapshot(): Snapshot {
  return clone({
    favorites: state.favorites,
    favoritesActivity: null,
    accounts: state.accounts,
    activeAccountId: state.activeAccountId,
    theme: state.theme,
    engine: { status: 'ready' as const, accountId: state.activeAccountId },
    authentication: state.auth,
    busy: state.busy,
    collection: state.collection,
    collectionActivity: null,
    unlike: state.unlike,
    libraryRevision: state.revision,
    playback: state.playback,
    playbackPreferences: state.playbackPrefs,
    appPreferences: state.appPrefs,
    version: '0.1.0 · 界面预览'
  })
}

function matches(work: SeedWork, filter: any) {
  const source = filter.source
  if (source === 'favorites') {
    if (work.source !== 'favorites') return false
    if (filter.folderId && !work.folderIds.includes(filter.folderId)) return false
  } else if (source === 'likes' || source === undefined) {
    if (work.source !== 'likes') return false
  }
  if (filter.mediaType && filter.mediaType !== 'all' && work.mediaType !== filter.mediaType) return false
  const date = new Date(work.publishedAt * 1000)
  if (filter.year && date.getFullYear() !== filter.year) return false
  if (filter.month && date.getMonth() + 1 !== filter.month) return false
  const search = (filter.search ?? '').trim().toLowerCase()
  if (search && !`${work.title} ${work.author}`.toLowerCase().includes(search)) return false
  return true
}

function query(filter: any) {
  const items = state.works.filter((work) => matches(work, filter))
  items.sort((a, b) =>
    filter.sort === 'collected' ? b.collectedAt - a.collectedAt : b.publishedAt - a.publishedAt
  )
  const years = [
    ...new Set(
      state.works
        .filter((work) => matches(work, { ...filter, year: null, month: null }))
        .map((work) => new Date(work.publishedAt * 1000).getFullYear())
    )
  ].sort((a, b) => b - a)
  const offset = filter.offset ?? 0
  const limit = filter.limit ?? 60
  return {
    items: clone(items.slice(offset, offset + limit).map(({ duration, folderIds, source, collectedAt, ...work }) => work)),
    total: items.length,
    years
  }
}

function overview(accountId: string): LibraryOverview {
  const works = state.works
  const likes = works.filter((work) => work.source === 'likes').length
  const favorites = works.filter((work) => work.source === 'favorites').length
  const years = new Map<number | null, number>()
  for (const work of works) {
    const year = new Date(work.publishedAt * 1000).getFullYear()
    years.set(year, (years.get(year) ?? 0) + 1)
  }
  return {
    accountId,
    metadataBytes: 2_834_112,
    total: works.length,
    videos: works.filter((work) => work.mediaType === 'video').length,
    galleries: works.filter((work) => work.mediaType === 'gallery').length,
    live: works.filter((work) => work.isLive).length,
    recent: clone(
      [...works]
        .sort((a, b) => b.collectedAt - a.collectedAt)
        .slice(0, 6)
        .map(({ duration, folderIds, source, collectedAt, ...work }) => work)
    ),
    likes,
    favorites,
    overlap: 0,
    folders: state.folders.length,
    years: [...years.entries()]
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
  }
}

function buildQueue(input: any, queueId = uid()): QueueState {
  let list: SeedWork[]
  if (input.source.type === 'ids') {
    const ids = new Set<string>(input.source.ids)
    list = state.works.filter((work) => ids.has(work.id))
  } else {
    list = state.works.filter((work) => matches(work, input.source.filter))
  }
  list = [...list].sort((a, b) =>
    input.source.sort === 'collected' ? b.collectedAt - a.collectedAt : b.publishedAt - a.publishedAt
  )
  if (input.mode === 'shuffle') {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[list[i], list[j]] = [list[j], list[i]]
    }
  }
  const index = Math.max(0, input.startWorkId ? list.findIndex((work) => work.id === input.startWorkId) : 0)
  return {
    accountId: input.accountId,
    queueId,
    revision: 1,
    source: input.source.source ?? (input.source.type === 'filter' ? input.source.filter.source : 'likes'),
    mode: input.mode,
    index,
    total: list.length,
    position: { seconds: 0, slide: 0, musicSeconds: 0 },
    completed: false,
    work: stripSeed(list[index]),
    next: list[index + 1] ? stripSeed(list[index + 1]) : null
  } as QueueState
}

const stripSeed = (work: SeedWork): Work => {
  const { duration, folderIds, source, collectedAt, ...rest } = work
  return rest
}

function media(workId: string): Media {
  const source = state.works.find((work) => work.id === workId)!
  const work = stripSeed(source)
  const index = state.works.indexOf(source)
  return {
    work,
    videos: work.mediaType === 'video' ? [demoClips[index % demoClips.length]] : [],
    images:
      work.mediaType === 'gallery'
        ? [clone(work.coverUrl!), clone(source.coverUrl!), clone(source.coverUrl!)].map((url) => ({
            url,
            liveUrl: null
          }))
        : [],
    music: null
  }
}

function favoriteFolders(): FavoriteFolder[] {
  return clone(
    state.folders.map((folder) => ({
      ...folder,
      localCount: state.works.filter((work) => work.folderIds.includes(folder.id)).length
    }))
  )
}

function collectionTask(mode: CollectionTask['mode']): CollectionTask {
  return {
    id: uid(),
    accountId: state.activeAccountId,
    mode,
    phase: 'head',
    status: 'running',
    cursor: '',
    backfillCursor: null,
    pages: 0,
    received: 0,
    added: 0,
    reason: null,
    errorCode: null,
    updatedAt: now()
  }
}

/** 演示用的“采集/同步”动画：几秒内推进计数并补几条新内容。 */
function runCollection(delay: number) {
  const task = collectionTask('update')
  state.collection = task
  emit()
  const timer = setInterval(() => {
    if (!state.collection || state.collection.id !== task.id) return clearInterval(timer)
    const job = state.collection
    job.pages += 1
    job.received += 18
    job.updatedAt = now()
    emit()
    if (job.pages >= 3) {
      clearInterval(timer)
      job.status = 'completed'
      job.added = 2
      job.received = 54
      const extra = [
        ['新收的玉米，掰一根给你', '阿福的菜园', 'video'],
        ['巷子口修鞋的老师傅', '小城故事', 'video']
      ] as const
      extra.forEach(([title, author, mediaType], i) => {
        const index = state.works.length + i
        state.works.unshift({
          id: String(3_700_000_000 + Math.floor(Math.random() * 100000)),
          title,
          author,
          publishedAt: Math.floor(now() / 1000) - i * 3600,
          coverUrl: seedWorks[index % seedWorks.length].coverUrl,
          mediaType,
          isLive: false,
          source: 'likes',
          collectedAt: Math.floor(now() / 1000),
          folderIds: [],
          duration: 30
        })
      })
      state.favorites = null
      emit()
    }
  }, delay)
}

function handle<K extends keyof Outputs>(command: string, input: any): Outputs[K] {
  switch (command) {
    case 'snapshot':
      return snapshot() as Outputs[K]
    case 'createAccount': {
      const created: Account = {
        id: uid(),
        name: input.name,
        remoteId: null,
        nickname: null,
        avatarUrl: null,
        createdAt: now(),
        lastVerifiedAt: null
      }
      state.accounts.push(created)
      state.activeAccountId = created.id
      emit()
      return created as Outputs[K]
    }
    case 'switchAccount':
      state.activeAccountId = input.accountId
      state.playback = null
      emit()
      return null as Outputs[K]
    case 'renameAccount': {
      const target = accountById(input.accountId)!
      target.name = input.name
      emit()
      return target as Outputs[K]
    }
    case 'logoutAccount': {
      const target = accountById(input.accountId)
      if (target) target.lastVerifiedAt = null
      emit()
      return null as Outputs[K]
    }
    case 'removeAccount': {
      state.accounts = state.accounts.filter((item) => item.id !== input.accountId)
      if (state.activeAccountId === input.accountId) state.activeAccountId = state.accounts[0]?.id ?? ''
      emit()
      return null as Outputs[K]
    }
    case 'login':
    case 'probe': {
      const target = accountById(input.accountId) ?? state.accounts[0]
      target.nickname = target.nickname ?? '快看小王'
      target.remoteId = target.remoteId ?? '3x7d9k2m1p'
      target.lastVerifiedAt = now()
      emit()
      return (command === 'probe' ? target : null) as Outputs[K]
    }
    case 'collectPage':
      return { received: 18, added: 0, hasMore: false, cursor: '' } as Outputs[K]
    case 'collectionStart':
      runCollection(900)
      return state.collection as Outputs[K]
    case 'collectionControl': {
      if (state.collection) {
        state.collection.status =
          input.action === 'stop' ? 'stopped' : input.action === 'pause' ? 'paused' : 'running'
        state.collection.updatedAt = now()
      }
      emit()
      return state.collection as Outputs[K]
    }
    case 'favoritesStart': {
      state.favorites = {
        id: uid(),
        accountId: state.activeAccountId,
        stage: 'all',
        folderId: null,
        cursor: '',
        status: 'running',
        pages: 0,
        received: 0,
        added: 0,
        foldersDone: 0,
        foldersTotal: state.folders.length,
        reason: null,
        errorCode: null,
        updatedAt: now()
      }
      emit()
      setTimeout(() => {
        if (!state.favorites) return
        state.favorites.status = 'completed'
        state.favorites.pages = 2
        state.favorites.received = 12
        state.favorites.added = 0
        state.favorites.foldersDone = state.folders.length
        state.favorites.updatedAt = now()
        emit()
      }, 2200)
      return state.favorites as Outputs[K]
    }
    case 'favoritesControl':
      return state.favorites as Outputs[K]
    case 'stopRequest':
    case 'releaseEngine':
      return null as Outputs[K]
    case 'query':
      return query(input) as Outputs[K]
    case 'matchingIds':
      return clone(state.works.filter((work) => matches(work, input)).map((work) => work.id)) as Outputs[K]
    case 'libraryOverview':
      return overview(input.accountId) as Outputs[K]
    case 'deleteLocal': {
      const ids = new Set<string>(input.workIds)
      const before = state.works.length
      state.works = state.works.filter((work) => !ids.has(work.id))
      emit()
      return { removed: before - state.works.length } as Outputs[K]
    }
    case 'unlikeStart': {
      const ids = new Set<string>(input.workIds)
      const total = ids.size
      const task = {
        id: uid(),
        accountId: input.accountId,
        source: input.source,
        mode: input.mode,
        remoteId: '',
        status: 'running' as const,
        reason: null,
        errorCode: null,
        createdAt: now(),
        updatedAt: now(),
        total,
        pending: total,
        inflight: 1,
        success: 0,
        failed: 0,
        unknown: 0
      }
      state.unlike = task as Snapshot['unlike']
      emit()
      setTimeout(() => {
        state.works = state.works.filter((work) => !ids.has(work.id))
        if (state.unlike) {
          state.unlike.status = 'completed'
          state.unlike.pending = 0
          state.unlike.inflight = 0
          state.unlike.success = total
          state.unlike.updatedAt = now()
        }
        emit()
      }, 1200)
      return state.unlike as Outputs[K]
    }
    case 'unlikeControl':
    case 'unlikeVerify':
      return state.unlike as Outputs[K]
    case 'unlikeItems':
      return {
        items: Array.from({ length: Math.min(input.limit, 50) }, (_, i) => ({
          position: input.offset + i + 1,
          workId: '0',
          title: '演示条目',
          status: 'success' as const,
          reason: null,
          errorCode: null
        })),
        total: 0
      } as Outputs[K]
    case 'unlikeHistory':
      return [] as unknown as Outputs[K]
    case 'queueCreate': {
      const queue = buildQueue(input)
      state.playback = queue
      emit()
      return queue as Outputs[K]
    }
    case 'queueResume':
      return clone(state.playback!) as Outputs[K]
    case 'queueMove': {
      const queue = clone(state.playback!)
      const target =
        input.target === 'next' ? queue.index + 1 : input.target === 'previous' ? queue.index - 1 : input.target
      const index = Math.min(queue.total - 1, Math.max(0, target))
      const list = state.works.filter((work) => work.source === (queue.source ?? 'likes'))
      void list
      queue.index = index
      queue.revision += 1
      queue.completed = false
      queue.position = { seconds: 0, slide: 0, musicSeconds: 0 }
      const work = state.works.find((item) => item.id === queue.work.id)
      void work
      state.playback = queue
      emit()
      return queue as Outputs[K]
    }
    case 'queueProgress': {
      const queue = state.playback
      if (queue) queue.position = input.position
      return (queue ?? null) as Outputs[K]
    }
    case 'queueEnd': {
      const queue = clone(state.playback!)
      queue.position = input.position
      if (input.advance && queue.index + 1 < queue.total) {
        queue.index += 1
        queue.completed = false
      } else {
        queue.completed = true
      }
      queue.revision += 1
      state.playback = queue
      emit()
      return queue as Outputs[K]
    }
    case 'queueReplay': {
      const queue = clone(state.playback!)
      queue.completed = false
      queue.position = { seconds: 0, slide: 0, musicSeconds: 0 }
      queue.revision += 1
      state.playback = queue
      emit()
      return queue as Outputs[K]
    }
    case 'queueDismiss':
      state.playback = null
      emit()
      return null as Outputs[K]
    case 'cancelMedia':
      return null as Outputs[K]
    case 'queueItems': {
      const items = state.works.map((work, index) => ({ index, work: stripSeed(work) }))
      return { items: items.slice(input.offset, input.offset + input.limit), total: items.length } as Outputs[K]
    }
    case 'media':
      return media(input.workId) as Outputs[K]
    case 'original':
      return null as Outputs[K]
    case 'favoriteStatus': {
      const work = state.works.find((item) => item.id === input.workId)
      return { collected: !!work && (work.source === 'favorites' || work.folderIds.length > 0) } as Outputs[K]
    }
    case 'favoriteFolders':
      return favoriteFolders() as Outputs[K]
    case 'favoriteEditor': {
      const work = state.works.find((item) => item.id === input.workId)!
      return {
        token: uid(),
        accountId: input.accountId,
        workId: input.workId,
        collected: work.source === 'favorites',
        localCount: state.works.filter((item) => item.source === 'favorites').length,
        folders: favoriteFolders().map((folder) => ({ ...folder, private: folder.private }))
      } as Outputs[K]
    }
    case 'favoriteSave': {
      const work = state.works.find((item) => item.id === input.workId)
      if (work) {
        work.source = 'favorites'
        work.folderIds = input.folderIds
      }
      emit()
      return { collected: true, foldersAdded: input.folderIds.length } as Outputs[K]
    }
    case 'favoriteCreateFolder': {
      const folder: FavoriteFolder = {
        id: uid(),
        title: input.name,
        remoteCount: 0,
        localCount: 0,
        private: input.private,
        coverUrl: null
      }
      state.folders.push(folder)
      emit()
      return folder as Outputs[K]
    }
    case 'playbackPreferences':
      state.playbackPrefs = playbackPreferencesSchema.parse({ ...state.playbackPrefs, ...input.preferences })
      emit()
      return null as Outputs[K]
    case 'appPreferences':
      state.appPrefs = appPreferencesSchema.parse({ ...state.appPrefs, ...input.preferences })
      emit()
      return state.appPrefs as Outputs[K]
    case 'theme':
      state.theme = input.theme
      emit()
      return null as Outputs[K]
    case 'windowPresentation':
      return null as Outputs[K]
    case 'runtimeEvents':
      return clone(state.events) as Outputs[K]
    case 'dataInfo':
      return {
        folder: 'C:\\Users\\Lenovo\\AppData\\Roaming\\MyLikeKuaishou',
        metadataBytes: 2_834_112,
        backupsBytes: 1_048_576,
        backupsCount: 3
      } as Outputs[K]
    case 'diagnostics':
      return {
        electron: '—',
        chromium: navigator.userAgent.replace(/^.*Chrome\//, 'Chromium ').split(' ')[0],
        node: '—',
        sqlite: 'SQLite（演示）',
        packaged: false,
        processes: []
      } as unknown as Outputs[K]
    case 'checkDatabase':
      return { ok: true, checkedAt: now(), issues: 0 } as Outputs[K]
    case 'copyDiagnostics':
    case 'openReleases':
    case 'openProject':
    case 'openDataFolder':
    case 'clearCache':
      return null as Outputs[K]
    case 'backup':
      return { fileName: 'mylike-kuaishou-2026-10-30.backup' } as Outputs[K]
    case 'exportLibrary':
      return { fileName: 'mylike-kuaishou-喜欢-2026-10-30.json', count: 42 } as Outputs[K]
    case 'importLibrary':
      return {
        token: uid(),
        accountId: input.accountId,
        accountName: accountById(input.accountId)?.name ?? '我的快手',
        fileName: 'mylike-kuaishou-喜欢-2026-10-28.json',
        sourceLabel: '喜欢',
        total: 42,
        newCount: 3,
        existingCount: 39,
        duplicates: 0
      } as Outputs[K]
    case 'importCommit':
      return { received: 42, added: 3, duplicates: 0 } as Outputs[K]
    case 'importCancel':
      return null as Outputs[K]
    default:
      return null as Outputs[K]
  }
}

export function installMock() {
  if ((window as any).mylike) return
  const api: DesktopAPI = {
    invoke: async (command: any, input: any) => {
      try {
        // 让界面上的加载态有真实的呼吸感
        await new Promise((resolve) => setTimeout(resolve, 40))
        return { ok: true, data: handle(command, input ?? {}) }
      } catch (error) {
        return {
          ok: false,
          error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : '演示数据异常' }
        }
      }
    },
    onChanged(callback: () => void) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    onBeforeQuit() {
      return () => {}
    }
  }
  ;(window as any).mylike = api
  void deepLink
  void seedFolders
}
