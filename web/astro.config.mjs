import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// 页面默认在构建时预渲染成静态文件；物种页（/s/…）由 Worker 按需渲染，数据来自 D1。
export default defineConfig({
  site: process.env.SITE_URL || 'https://baicaoyuan.example',
  adapter: cloudflare({ imageService: 'passthrough' }),
  session: false,
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
