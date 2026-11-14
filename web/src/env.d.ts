/// <reference types="astro/client" />

declare module 'cloudflare:workers' {
  export const env: { ASSETS: { fetch(input: URL | string | Request): Promise<Response> } };
}
