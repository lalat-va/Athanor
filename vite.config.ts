export defineConfig({
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
