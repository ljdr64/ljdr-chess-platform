import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        headers: {
            'Cross-Origin-Embedder-Policy': 'require-corp',
            'Cross-Origin-Opener-Policy': 'same-origin',
        },
    },
    resolve: {
        alias: {
            '@ChessPlatform': path.resolve(__dirname, 'src'),
            '@Chess': path.resolve(__dirname, 'src/Chess'),
            '@Platform': path.resolve(__dirname, 'src/Platform'),
            '@Services': path.resolve(__dirname, 'src/Services'),
            '@Utils': path.resolve(__dirname, 'src/Utils'),
            '@Global': path.resolve(__dirname, 'src/Global'),
        },
    },
});
