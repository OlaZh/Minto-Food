# Admin Launch Readiness

## Automated gates

- `npm run lint`
- `npm run build`
- `npm run test:security`

## What `test:security` covers

- Anonymous user cannot open protected admin routes and is redirected to `/login`
- Logged-in non-admin user cannot open protected admin routes and is redirected to `/unauthorized`
- `assertAdmin()` keeps rejecting missing session, broken profile lookup, and non-admin access
- Secure admin transfer accepts messages only from the configured main-site origin and requires both session tokens

## Manual QA flow before launch

### Access control

- Open `/dashboard` in a clean browser session: confirm redirect to `/login`
- Sign in with a non-admin account and open `/dashboard`: confirm redirect to `/unauthorized`
- Sign in with an admin account and open `/dashboard`, `/reports`, `/users`: confirm access works

### Secure transfer

- Trigger “open admin” from the main site
- Confirm the admin tab lands on `/dashboard`
- Confirm no `access_token` or `refresh_token` appears in the URL, browser history, or copied links

### Error visibility

- Force one admin action to fail in a safe environment, for example by temporarily removing permission or using invalid data
- Confirm the action shows a visible error toast instead of silently refreshing the page

### Moderation regressions

- Delete recipe from a report and confirm the report no longer stays `pending`
- Try self-demotion as admin and confirm it is blocked
- Try demoting the last remaining admin and confirm it is blocked

### Data sanity

- Dashboard “Активних (7д)” should match unique active users, not meal rows
- Recipes search should find `name_ua`, `name_en`, and `name_pl`
- Users and Products pagination should still work after filtering on the current page

### Mobile sanity

- Open admin on a narrow viewport
- Confirm bottom navigation does not overlap content
- Confirm “На сайт” is reachable from mobile nav

## Release note

- Current admin protection is redirect-based, not literal HTTP `403` responses
- For this project, launch readiness means “access is blocked and verifiable”, not necessarily “every denial returns status 403”
