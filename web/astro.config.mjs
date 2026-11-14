import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// 页面默认在构建时预渲染成静态文件；只有物种页（/s/…）由 Worker 按需渲染，
// 因为 3.8 万个物种各出一个文件会超过 Cloudflare 免费额度的 2 万个静态文件。
export default defineConfig({
  site: process.env.SITE_URL || 'https://baicaoyuan.example',
  adapter: cloudflare({ imageService: 'passthrough' }),
  session: false,
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
