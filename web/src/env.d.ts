/// <reference types="astro/client" />

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

declare module 'cloudflare:workers' {
  export const env: {
    ASSETS: { fetch(input: URL | string | Request): Promise<Response> };
    DB: { prepare(sql: string): D1Statement; batch(statements: D1Statement[]): Promise<unknown> };
    /** Pl@ntNet 的 API key。线上是 Worker 的 secret，本地放在 .dev.vars。 */
    PLANTNET_API_KEY?: string;
  };
}

declare namespace App {
  interface Locals {
    cfContext: { waitUntil(promise: Promise<unknown>): void };
  }
}
