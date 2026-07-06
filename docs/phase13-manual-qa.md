# Phase 13 Manual QA

Updated: 2026-06-27

This checklist covers the remaining manual QA for Roadmap Phase 13: legal/GDPR.

## Current status

- Ready to test: GDPR export
- Ready to test: GDPR account deletion request
- Ready to test: signup age gate
- Ready to test: cookie banner display, choices, and persistence
- Blocked from full analytics verification: PostHog SDK is not integrated yet, so there is no live analytics loader to prove "refuse all -> analytics does not load"
- Not launch-ready from legal side: `privacy.html`, `terms.html`, and `cookies.html` still contain placeholder/template text such as `[ДАТА]`

## Source-backed checks already confirmed

- `profile.html` contains a GDPR card in Settings and a delete-account action.
- `js/profile.js` wires:
  - `gdprExportBtn` -> `GET /api/gdpr-export`
  - `deleteAccountBtn` -> confirm modal -> `supabase.rpc('soft_delete_user')`
  - deletion status UI -> `profiles.deletion_scheduled_for`
- `api/gdpr-export.js` requires a bearer token, exports JSON, and logs export requests into `gdpr_requests`.
- `js/cookie-consent.js` stores consent:
  - guest -> `localStorage`
  - logged-in user -> `profiles.consent_*`
- `cookies.html` has a "reopen cookie banner" button wired to `reopenCookieBanner()`.
- `js/auth.js` keeps the register button disabled until the age checkbox is checked and rejects submit if it is not checked.
- Remote Supabase was already verified for `soft_delete_user(uuid)`:
  - `authenticated` and `service_role` have `EXECUTE`
  - `anon` and `PUBLIC` no longer have it
  - function body now rejects `auth.uid() IS NULL`

## Scenario 1: GDPR export

Status: Ready

Preconditions:

- Use a real test account with at least:
  - filled profile
  - one cookbook
  - one recipe
- Be logged in

Steps:

1. Open `profile.html`
2. Go to `Settings`
3. In the `GDPR і приватність` card, click `Завантажити мої дані`
4. Wait for the file download
5. Open the downloaded JSON

Expected result:

- Download starts without a page crash
- Filename looks like `mintofood-export-XXXXXXXX.json`
- JSON contains (expanded 2026-07-06 — export now covers all personal data incl. health):
  - `exported_at`
  - `user_id`
  - `email`
  - `profile`
  - `health_profile` (user_profiles: age, height, weight, goals, norms)
  - `recipes`
  - `cookbooks`
  - `meals`
  - `water`
  - `week_meals`
  - `weight_records`
  - `activities`
  - `streaks`
  - `shopping_lists`
  - `shopping_items`
  - `gdpr_requests`

Optional DB check:

```sql
select type, status, requested_at, completed_at
from gdpr_requests
where user_id = '<USER_ID>'
order by requested_at desc;
```

Expected DB result:

- A fresh `type = 'export'` row exists
- Status is `completed` for the successful export

## Scenario 2: GDPR account deletion request

Status: Ready

Preconditions:

- Use a disposable test account
- Be logged in
- Ensure the account is not already scheduled for deletion

Steps:

1. Open `profile.html`
2. Go to `Settings`
3. Click `Запросити видалення акаунту`
4. Confirm in the modal
5. Stay on the page after the action completes
6. Reload the page once

Expected result:

- A confirmation modal appears before deletion is requested
- After confirm, the action completes without a page crash
- The GDPR status changes from idle to a scheduled deletion date
- The delete button becomes disabled after the request
- After reload, the scheduled state still shows

Optional DB check:

```sql
select id, deletion_requested_at, deletion_scheduled_for
from profiles
where id = '<USER_ID>';

select type, status, requested_at, completed_at
from gdpr_requests
where user_id = '<USER_ID>'
order by requested_at desc;
```

Expected DB result:

- `deletion_requested_at` is set
- `deletion_scheduled_for` is about 30 days in the future
- A fresh `gdpr_requests` row exists with `type = 'delete'`

## Scenario 3: Cookie banner for guest users

Status: Partially ready

Preconditions:

- Use a clean browser profile or clear site storage first
- Stay logged out

Steps:

1. Open any public page such as `index.html`
2. Verify the cookie banner appears
3. Click `Відхилити все`
4. Reload the page
5. Open DevTools -> Application/Storage -> Local Storage
6. Check `minto_consent`
7. Go to `cookies.html`
8. Click `Відкрити налаштування cookies`
9. Enable only analytics and save

Expected result:

- Banner appears on first visit
- After `Відхилити все`, banner disappears
- After reload, banner does not reappear immediately for the same consent version
- `minto_consent` exists in localStorage
- Stored payload contains:
  - `necessary: true`
  - `analytics: false` after reject all
  - `marketing: false` after reject all
  - `version: '1'`
- Reopen on `cookies.html` clears prior choice and shows the banner again
- Saving a custom choice updates localStorage accordingly

Blocked assertion:

- Do not mark "analytics did not load" as passed yet.
- Reason: the repo currently does not include a live PostHog SDK integration, so there is no analytics runtime to suppress or observe.

## Scenario 4: Cookie consent sync for logged-in users

Status: Ready

Preconditions:

- Test account exists
- Consent has not been stored in `profiles` yet, or use a fresh account

Steps:

1. Log in
2. If the banner appears, choose any option
3. Reload the page
4. Open another public page
5. Optionally sign out and sign back in with the same account on the same browser

Expected result:

- Consent is saved without crashing
- The banner does not keep reappearing after the choice is saved
- The choice survives page reload

Optional DB check:

```sql
select consent_analytics, consent_marketing, consent_version, consent_at
from profiles
where id = '<USER_ID>';
```

Expected DB result:

- `consent_version = '1'`
- `consent_analytics` and `consent_marketing` match the selected choice
- `consent_at` is populated

## Scenario 5: Signup age gate

Status: Ready

Preconditions:

- Stay logged out

Steps:

1. Open the auth modal
2. Switch to `Register`
3. Leave the age checkbox unchecked
4. Verify the submit button stays disabled
5. Check the age/consent checkbox
6. Verify the submit button becomes enabled
7. Uncheck again and confirm it becomes disabled

Expected result:

- Register submit is disabled until the checkbox is checked
- The consent text links to `terms.html` and `privacy.html`
- If submit is somehow triggered without the checkbox, the UI shows the age-required validation error

## Scenario 6: Legal path smoke test

Status: Ready, but not launch-ready

Steps:

1. Open `privacy.html`
2. Scroll to the GDPR rights section
3. Verify it points users to `Профіль -> Налаштування -> GDPR`
4. Open `cookies.html`
5. Verify the cookie policy describes:
  - `minto_consent`
  - analytics cookies
  - the reopen-settings button

Expected result:

- The public legal path points to the implemented GDPR entry point in profile settings
- The cookies page offers a visible way to reopen consent settings

Known legal blockers still visible in source:

- ~~`privacy.html` still contains `[ДАТА]`~~ — resolved 2026-07-06: rewritten as v1.0 based on actual codebase facts
- ~~`terms.html` still contains `[ДАТА]`~~ — resolved 2026-07-06: rewritten as v1.0
- ~~template warnings~~ — removed 2026-07-06 (documents are now accurate, not templates)
- STILL OPEN: `imprint.html` operator placeholders (company name, address, NIP) — only the owner can fill these
- Lawyer review deliberately deferred until before Phase 19 (monetization) — decision 2026-07-06

## Optional staging-only check: hard delete cron

Status: Do not run on production casually

Use only in staging with a disposable account whose `deletion_scheduled_for` is already in the past.

Expected result:

- `api/cron/gdpr-hard-delete.js` finds the due user
- `hard_delete_user_data()` removes app data
- Supabase Admin API removes `auth.users`

## Exit criteria for Phase 13 manual QA

You can treat the manual QA tail of Phase 13 as done when all of the following are true:

- GDPR export download passes
- GDPR delete request passes
- Cookie banner choice/persistence passes
- Signup age gate passes
- Legal path smoke test passes

Keep this still open separately:

- analytics suppression proof, until a real analytics SDK is integrated
- final legal copy replacement and legal review
