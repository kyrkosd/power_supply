// electron.vite.config.ts
import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve("electron/main.ts")
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve("electron/preload.ts")
      }
    }
  },
  renderer: {
    root: resolve("src"),
    build: {
      rollupOptions: {
        input: resolve("src/index.html")
      }
    },
    resolve: {
      alias: {
        "@renderer": resolve("src"),
        "@engine": resolve("src/engine"),
        "@store": resolve("src/store"),
        "@components": resolve("src/components"),
        "@data": resolve("src/data")
      }
    },
    plugins: [react()]
  }
});
export {
  electron_vite_config_default as default
};
