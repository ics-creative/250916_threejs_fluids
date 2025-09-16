import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    // GitHub Pagesにデモをデプロイするため、ビルド先を標準のdistディレクトリから変更
    outDir: "docs",
    rollupOptions: {
      input: {
        index: "index.html",
        demo1: "demo1.html",
        demo2: "demo2.html",
        demo3: "demo3.html",
        demo4: "demo4.html",
      },
    },
  },
});
