// astro.config.mjs
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server', // <-- ESTO ES CLAVE para que funcione la API
  adapter: vercel(),
});