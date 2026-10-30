import type { EngineStatus } from '../../shared/contracts'
import type { RuntimeEventInput } from '../../shared/runtime-events'
import type { AccessEvent, AccessTarget, Operation, PageState } from './access'

/** 平台引擎的公共接口：演示引擎与真实快手引擎都实现它。 */
export interface PlatformEngine {
  snapshot(): { status: EngineStatus; accountId: string | null }
  setObserver(observer: ((accountId: string, event: RuntimeEventInput) => void) | null): void
  setAttentionHandler(handler: ((event: AccessEvent) => void) | null): void
  setInteraction(kind: 'login' | 'verification' | null): void
  allowAttention(): void
  recoveryTarget(accountId: string): AccessTarget | null
  dismissAttention(accountId: string): void
  requireAttention(accountId: string, kind: 'login' | 'verification', target?: AccessTarget): void
  cancelRecovery(accountId: string): void
  pageState(accountId: string): Promise<PageState>
  show(accountId: string): Promise<void>
  hide(accountId: string, verified?: boolean): void
  request(
    accountId: string,
    operation: Operation,
    parameters?: Record<string, string>,
    options?: { recovery?: boolean; loginCheck?: boolean }
  ): Promise<Record<string, any>>
  cancel(): void
  release(notify?: boolean): void
  logout(accountId: string): Promise<void>
  purgeAccount(accountId: string): Promise<void>
  clearCaches(accountId: string): Promise<void>
}
