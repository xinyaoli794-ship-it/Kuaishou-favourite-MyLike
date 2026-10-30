import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 浏览器预览：只构建渲染层，数据来自 src/renderer/src/mock。
// 桌面版请使用 `npm run dev` / `npm run package:win`。
export default defineConfig({
  root: resolve('src/renderer'),
  publicDir: resolve('public'),
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5178, strictPort: true },
  build: { outDir: resolve('dist-web'), emptyOutDir: true }
})
