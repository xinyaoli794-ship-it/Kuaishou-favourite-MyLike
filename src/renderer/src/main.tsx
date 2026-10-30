import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './style.css'
import { installMock } from './mock/api'

// 桌面版由 Electron preload 注入 window.mylike；浏览器预览时用同一套接口的演示实现。
installMock()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
