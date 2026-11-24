'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const buildPath = path.join(root, '.github', 'workflows', 'build.yml');
const ciPath = path.join(root, '.github', 'workflows', 'ci-cd.yml');
const build = fs.readFileSync(buildPath, 'utf8');
const ci = fs.readFileSync(ciPath, 'utf8');

function countMatches(text, expression) {
  return [...text.matchAll(expression)].length;
}

function externalUses(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => /^\s*uses:\s*/.test(line) && !/^\s*#/.test(line))
    .map(
      (line) =>
        line
          .trim()
          .replace(/^uses:\s*/, '')
          .split(/\s+#/)[0]
    );
}

function validatePinnedActions(workflow, label) {
  const floating = externalUses(workflow).filter(
    (reference) => !reference.startsWith('./') && !/@[0-9a-f]{40}$/i.test(reference)
  );
  assert.deepEqual(floating, [], `${label} contains an action not pinned to a full SHA`);
}

// EAS build must be manual, protected to main, and use a protected environment.
assert.match(build, /^on:\s*\n\s+workflow_dispatch:/m);
assert.doesNotMatch(build, /^\s+(push|pull_request):/m);
assert.match(build, /^\s+if: github\.ref == 'refs\/heads\/main'$/m);
assert.match(build, /^\s+environment:\s*\n\s+name: eas-build$/m);
assert.doesNotMatch(build, /inputs\.ref|BUILD_REF|^\s+ref:/m);
assert.match(build, /^\s+eas-version: \d+\.\d+\.\d+$/m);
assert.doesNotMatch(build, /eas-version:\s*latest/i);
assert.equal(countMatches(build, /^\s+EXPO_TOKEN:/gm), 1, 'EXPO_TOKEN must be scoped to one step');
assert.match(build, /- name: Run EAS build[\s\S]*?EXPO_TOKEN: \$\{\{ secrets\.EAS_TOKEN \}\}/);
assert.doesNotMatch(build, /^\s+token:\s*\$\{\{\s*secrets\./m);
validatePinnedActions(build, 'build.yml');

// High/critical npm audit findings block CI, excluding only tracked GHSA-5p2g-fcmc-qvqq (source 1112648).
assert.match(ci, /name: Security Audit[\s\S]*?--audit-level=high[\s\S]*?--omit=dev[\s\S]*?1112648/);
assert.doesNotMatch(ci, /npm audit[^\n]*\|\|\s*true/);

// Codecov is deliberately visible as informational, not a silently-failing gate.
assert.match(ci, /name: Upload coverage to Codecov \(informational\)/);
assert.match(ci, /fail_ci_if_error: false[\s\S]*?continue-on-error: true/);

// Secret scanning covers every push branch in this workflow and its PR targets.
assert.match(ci, /branches: \[main, develop, 'fix\/\*\*', 'feature\/\*\*'\]/);
assert.match(ci, /pull_request:\s*\n\s+branches: \[main, develop\]/);
assert.match(ci, /name: Check for secrets in code \(push and pull request\)/);
assert.match(ci, /if: github\.event_name == 'pull_request' \|\| github\.event_name == 'push'/);
assert.match(ci, /trufflesecurity\/trufflehog@[0-9a-f]{40}/i);
assert.match(ci, /version: 3\.99\.8/);
assert.match(ci, /extra_args: --results=verified,unknown --exclude-paths=\.trufflehog-exclude/);
assert.match(ci, /fetch-depth: 0/);
assert.doesNotMatch(ci, /pull_request_target/);
validatePinnedActions(ci, 'ci-cd.yml');

console.log('Security workflow contracts passed.');
