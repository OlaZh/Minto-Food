# MintoFood — Release Checklist

> Виконувати перед кожним deploy у production.

---

## ⚠️ При додаванні нового стороннього сервісу (PostHog, Sentry, Resend, Stripe і т.д.)

Якщо новий сервіс встановлює **будь-які cookies або збирає дані** — обов'язково:

1. Підвищити `CONSENT_VERSION` у `js/cookie-consent.js` (наприклад `'1'` → `'2'`)
2. Додати сервіс у список sub-processors у `privacy.html#processors`
3. Оновити `cookies.html` — описати новий cookie / категорію
4. Підписати DPA з провайдером (якщо ЄС-дані — обов'язково)

> Без bump версії — всі існуючі юзери **не побачать повторний банер** і їхня згода буде юридично недійсною для нового сервісу.

---

## Pre-deploy

- [ ] Зміни протестовані на staging
- [ ] Sentry — немає нових помилок за останні 24 год
- [ ] Якщо є міграція — виконано на staging, є rollback-файл, зроблено backup БД
- [ ] Якщо додано новий сторонній сервіс → виконано чеклист вище ☝️

## Deploy

- [ ] `git push` → Vercel автоматично деплоїть з main
- [ ] Vercel Dashboard — білд пройшов без помилок
- [ ] Якщо є міграція — виконати в Supabase SQL Editor (prod)

## Smoke test після deploy (5 хвилин)

- [ ] Відкрити сайт в incognito
- [ ] Login → перейти на "Меню на день" → додати meal → зберегти
- [ ] Відкрити рецепт (публічний URL `/recipe/{slug}`)
- [ ] Відкрити "Рецепти" → пошук → результати є
- [ ] Мобільний вигляд (DevTools → 375px) — хедер, контент, футер OK

## Моніторинг після deploy

- [ ] Sentry — моніторити +2 год після deploy
- [ ] Якщо error rate > 0.5% → розглянути rollback
- [ ] UptimeRobot — сайт в online статусі

## Rollback (якщо потрібно)

1. Vercel Dashboard → Deployments → попередній deploy → "Redeploy"
2. Якщо була міграція → виконати `_rollback.sql` у Supabase SQL Editor

---

## Критичні контакти

- Vercel: dashboard.vercel.com
- Supabase: app.supabase.com
- Sentry: sentry.io
- UptimeRobot: uptimerobot.com
