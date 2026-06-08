# Repo Working Rules

These rules apply repo-wide unless a deeper `AGENTS.md` adds more specific instructions.

## Decision Making

- Do not make architecture, product, UX/UI, data-model, backend, API, validation, migration, or workflow decisions without explicit user approval.
- If there are multiple implementation options, hidden consequences, or any risk of changing the user's intended logic, stop and ask first.
- Do not simplify, remove, add, or reshape fields, payloads, schema, business logic, or UI behavior on your own initiative.
- You may analyze the issue, identify the root cause, and propose short options with tradeoffs, but the final decision belongs to the user.

## Safe Changes

- Safe local fixes that do not change the intended behavior may be implemented directly.
- If you are not sure whether a change is behavior-preserving, ask before editing.
