// no-undef / no-unused-vars check for the serverless api/ handlers.
// The root project has no ESLint config and the admin-app flat config doesn't
// cover ../api, so this runs the ESLint Linter API directly against api/*.js.
// It exists to catch the class of bug (a deleted top-level const referenced
// inside a try/catch) that `node --check` and tsc silently miss.
// Run: npm run lint:api   (from repo root)

const path = require('path');
const { readdirSync, readFileSync } = require('fs');

// ESLint lives in admin-app/node_modules.
let Linter;
try {
  ({ Linter } = require(path.join(__dirname, '..', 'admin-app', 'node_modules', 'eslint')));
} catch {
  console.error('ESLint not found (expected in admin-app/node_modules). Run `npm i` in admin-app.');
  process.exit(2);
}

const linter = new Linter();
const apiDir = path.join(__dirname, '..', 'api');

const globals = {
  process: 'readonly', fetch: 'readonly', Buffer: 'readonly', FormData: 'readonly',
  Blob: 'readonly', console: 'readonly', URLSearchParams: 'readonly', Promise: 'readonly',
  Number: 'readonly', Date: 'readonly', Math: 'readonly', JSON: 'readonly', Object: 'readonly',
  Array: 'readonly', String: 'readonly',
};

function lintFile(file) {
  const code = readFileSync(file, 'utf8');
  return linter.verify(code, {
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals },
    rules: { 'no-undef': 'error', 'no-unused-vars': 'warn' },
  });
}

let errors = 0;
for (const name of readdirSync(apiDir)) {
  if (!name.endsWith('.js')) continue;
  const file = path.join(apiDir, name);
  const msgs = lintFile(file);
  for (const m of msgs) {
    const tag = m.severity === 2 ? 'ERROR' : 'warn';
    if (m.severity === 2) errors++;
    console.log(`${tag} api/${name}:${m.line} ${m.ruleId} — ${m.message}`);
  }
}

if (errors === 0) console.log('lint:api CLEAN (no no-undef errors)');
process.exit(errors ? 1 : 0);
