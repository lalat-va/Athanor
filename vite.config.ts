import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [tailwindcss()],
                            root: './',
                            server: {
                                port: 3000,
                                host: true
                            },
                            build: {
                                outDir: 'dist',
                                emptyOutDir: true
                            }
});
