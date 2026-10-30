/** 平台访问相关的类型：与具体客户端（登录窗口 / 请求通道）解耦。 */

export type AccessOperation = 'self' | 'likes' | 'detail' | 'favorites' | 'folders' | 'folderItems'
export type WriteOperation =
  | 'unlike'
  | 'favoriteRemove'
  | 'favoriteAdd'
  | 'favoriteFolderAdd'
  | 'favoriteFolderCreate'
export type Operation = AccessOperation | WriteOperation

export function isWriteOperation(operation: Operation): operation is WriteOperation {
  return (
    operation === 'unlike' ||
    operation === 'favoriteRemove' ||
    operation === 'favoriteAdd' ||
    operation === 'favoriteFolderAdd' ||
    operation === 'favoriteFolderCreate'
  )
}

export type AccessTarget = {
  operation: AccessOperation
  parameters: Record<string, string>
}

export type AccessEvent =
  | { type: 'changed'; accountId: string }
  | { type: 'required'; accountId: string; kind: 'login' | 'verification'; target: AccessTarget }
  | { type: 'closed'; accountId: string }

export type PageState = { ready: boolean; captcha: boolean }
