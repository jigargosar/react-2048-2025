import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import eslint from 'vite-plugin-eslint2'

// https://vite.dev/config/
export default defineConfig({
    base: '/react-2048-2025/',
    plugins: [
        react({
            babel: {
                plugins: [['babel-plugin-react-compiler']],
            },
        }),
        tailwindcss(),
        eslint({
            cache: false,
            emitWarning: true,
            emitError: true,
        }),
    ],
})
