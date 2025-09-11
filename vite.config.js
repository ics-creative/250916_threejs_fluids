import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        demo1: "demo1.html",
        demo2: "demo2.html",
        demo3: "demo3.html",
      },
    },
  },
});
