import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from "vite-plugin-svgr";

import * as path from "node:path";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), svgr()],
    appType: 'mpa',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        }
    },
    build: {
        minify: false,
    },
    base: "https://njonathanj.com/MusicAnalyzer/"
})
