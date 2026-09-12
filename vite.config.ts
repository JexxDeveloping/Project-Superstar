import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // The dev server honours PORT so a second instance (e.g. an automated browser check) can run beside a playtest.
  server: { port: Number(process.env.PORT) || 5173, strictPort: false },
  test: {
    include: ['src/tests/**/*.test.ts'],
    environment: 'node',
  },
});
