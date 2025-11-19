import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import eslint from 'vite-plugin-eslint2'

// https://vite.dev/config/
export default defineConfig({
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
