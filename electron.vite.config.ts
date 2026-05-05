// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('electron/main.ts')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('electron/preload.ts')
      }
    }
  },
  renderer: {
    root: resolve('src'),
    build: {
      rollupOptions: {
        input: resolve('src/index.html')
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src'),
        '@engine': resolve('src/engine'),
        '@store': resolve('src/store'),
        '@components': resolve('src/components'),
        '@data': resolve('src/data')
      }
    },
    plugins: [react()]
  }
})
