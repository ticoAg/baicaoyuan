import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import cloudflare from '@astrojs/cloudflare';
import { writeServiceWorker } from './scripts/sw.mjs';

// 构建完成后生成 service worker，缓存急救页等应用外壳
const serviceWorker = {
  name: 'baicaoyuan-service-worker',
  hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      const { version, files } = await writeServiceWorker(fileURLToPath(dir));
      logger.info(`sw.js ${version}，预缓存 ${files} 个文件`);
    },
  },
};

// 页面默认在构建时预渲染成静态文件；物种页（/s/…）由 Worker 按需渲染，数据来自 D1。
export default defineConfig({
  site: process.env.SITE_URL || 'https://plants.ticoag.fun',
  adapter: cloudflare({ imageService: 'passthrough' }),
  integrations: [serviceWorker],
  session: false,
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
