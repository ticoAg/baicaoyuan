/// <reference types="astro/client" />

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

declare module 'cloudflare:workers' {
  export const env: {
    ASSETS: { fetch(input: URL | string | Request): Promise<Response> };
    DB: { prepare(sql: string): D1Statement };
  };
}

declare namespace App {
  interface Locals {
    cfContext: { waitUntil(promise: Promise<unknown>): void };
  }
}
