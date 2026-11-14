/// <reference types="astro/client" />

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

interface R2Object {
  body: ReadableStream;
  httpEtag: string;
  httpMetadata?: { contentType?: string };
}

declare module 'cloudflare:workers' {
  export const env: {
    ASSETS: { fetch(input: URL | string | Request): Promise<Response> };
    DB: { prepare(sql: string): D1Statement; batch(statements: D1Statement[]): Promise<unknown> };
    /** 后台上传的图片。 */
    IMAGES: {
      get(key: string): Promise<R2Object | null>;
      put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
      delete(keys: string | string[]): Promise<void>;
      list(options: { prefix: string }): Promise<{ objects: { key: string }[] }>;
    };
    /** Pl@ntNet 的 API key。线上是 Worker 的 secret，本地放在 .dev.vars。 */
    PLANTNET_API_KEY?: string;
    /** 管理员（名字是 admin）的密码。同上。 */
    ADMIN_PASSWORD?: string;
    /** 给登录状态签名、给密码哈希加料用的随机串。同上。这两个没有设置时后台不可用。 */
    SESSION_SECRET?: string;
  };
}

declare namespace App {
  interface Locals {
    cfContext: { waitUntil(promise: Promise<unknown>): void };
  }
}
