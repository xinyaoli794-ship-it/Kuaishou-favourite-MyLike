import type { Work } from '../../../shared/contracts'
import {
  demoBase,
  demoClipName,
  demoCoverDataUri,
  demoEntries,
  demoFolderIds,
  demoPublishedAt,
  demoWorkId
} from '../../../shared/demo-works'

/**
 * 浏览器预览用的演示数据：模拟一个已经采集过的快手账号。
 * 桌面版由主进程的演示引擎提供同样的数据并写入 SQLite。
 */
export interface SeedWork extends Work {
  source: 'likes' | 'favorites'
  collectedAt: number
  folderIds: string[]
  duration: number
}

/** 本地演示片段（CC0 / 测试素材），仅用于播放器外观预览。 */
export const demoClips = [demoClipName(0), demoClipName(1), demoClipName(2), demoClipName(3), demoClipName(4)].map(
  (name) => `/clips/${name}.mp4`
)

export const seedWorks: SeedWork[] = demoEntries.map(([title, author, mediaType], index) => {
  const folders = demoFolderIds(index)
  return {
    id: demoWorkId(index),
    title,
    author,
    publishedAt: demoPublishedAt(index),
    coverUrl: demoCoverDataUri(index),
    mediaType,
    isLive: false,
    source: folders.length ? 'favorites' : 'likes',
    collectedAt: demoBase - index * 3 * 3600,
    folderIds: folders,
    duration: 18 + ((index * 13) % 90)
  }
})

export const seedFolders = [
  { id: 'f-all', title: '默认收藏', remoteCount: 9, localCount: 5, private: false, coverUrl: null },
  { id: 'f-food', title: '深夜食堂', remoteCount: 6, localCount: 4, private: true, coverUrl: null },
  { id: 'f-travel', title: '想去的地方', remoteCount: 3, localCount: 2, private: true, coverUrl: null }
]
