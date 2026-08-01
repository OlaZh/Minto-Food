// instrumentation-client.ts — Next.js 16 клієнтська instrumentation
// (замінює старий sentry.client.config.ts з попередніх версій SDK).
// Виконується до React hydration. Без NEXT_PUBLIC_SENTRY_DSN — no-op.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
    // Очікувані/шумні помилки — не засмічують alert-rules (roadmap Фаза 16).
    ignoreErrors: ["AbortError", "Failed to fetch", "Load failed"],
  });
}

// Обов'язковий експорт SDK для інструментації App Router навігацій —
// без нього Sentry попереджає при білді ("ACTION REQUIRED").
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
