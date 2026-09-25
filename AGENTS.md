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

## Verification Code

- Do not retain unnecessary verification code in the repository. After completing verification, remove one-off diagnostic scripts, temporary QA/browser harnesses, and their unused helpers created for the task.
- Keep a small set of reusable regression tests that protect important behavior, such as privacy, access control, data integrity, and prevention of duplicate records. Do not remove useful tests solely to reduce the line count.
- Reuse existing checks where possible. Do not add duplicate tests, tests that merely mirror the implementation, or tests for reversible, low-impact changes.
- When removing temporary checks, also remove obsolete commands and references from documentation. Keep this cleanup separate from changes to application behavior.
