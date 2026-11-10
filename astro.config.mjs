import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwind from '@astrojs/tailwind'; // <-- Importamos Tailwind

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [tailwind()] // <-- Lo prendemos aquí
});