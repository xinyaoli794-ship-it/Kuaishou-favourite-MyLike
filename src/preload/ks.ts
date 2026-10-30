/**
 * 快手登录窗口的预加载脚本。
 *
 * 必须比页面脚本更早执行，才能捕获页面内置的签名环境（$encode）。
 * 该窗口关闭 contextIsolation、保留 sandbox 且不开放 Node，脚本只做这一件事。
 */
const capture = () => {
  const scope = window as unknown as { __ks_realm?: unknown }
  if (scope.__ks_realm) return
  let done = false
  const setter = function (this: any, value: unknown) {
    if (
      !done &&
      this &&
      typeof this === 'object' &&
      this !== window &&
      typeof this.$encode === 'function' &&
      typeof this.$getCatVersion === 'function'
    ) {
      done = true
      scope.__ks_realm = this
      try {
        delete (Object.prototype as any).caver
      } catch {
        /* 忽略 */
      }
    }
    Object.defineProperty(this, 'caver', {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    })
  }
  try {
    Object.defineProperty(Object.prototype, 'caver', { set: setter, configurable: true })
  } catch {
    /* 忽略 */
  }
}

capture()
