/**
 * validate-sensitive-literals.js
 *
 * Fails CI if it finds real AdMob IDs or Google API keys committed in code/docs.
 *
 * Notes:
 * - Allows Google test AdMob IDs (publisher 3940256099942544)
 * - Allows google-services.json to contain API keys (expected)
 * - Allows obvious placeholders like "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX" or "ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy"
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE_ROOT = path.resolve(__dirname, '..');

const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  'coverage',
  'dist',
  'web-build',
  '.expo',
  '.firebase',
]);

const EXCLUDED_FILES = new Set([
  // Firebase client config: contains API key by design
  path.join('google-services.json'),
]);

const ALLOWED_ADMOB_PUBLISHER_IDS = new Set([
  // Google-provided test publisher id
  '3940256099942544',
]);

const TEXT_FILE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.json',
  '.md',
  '.txt',
  '.yml',
  '.yaml',
  '.ps1',
  '.env',
  '.example',
]);

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_FILE_EXTENSIONS.has(ext) || path.basename(filePath).startsWith('.env');
}

function isExcludedFile(relPath) {
  if (EXCLUDED_FILES.has(relPath)) return true;

  // Ignore local env files (should not be committed). Still scan .env.example.
  const base = path.basename(relPath);
  if (base.startsWith('.env') && base !== '.env.example') {
    return true;
  }

  // Ignore lockfiles (high noise)
  if (
    relPath.endsWith('package-lock.json') ||
    relPath.endsWith('yarn.lock') ||
    relPath.endsWith('pnpm-lock.yaml')
  ) {
    return true;
  }
  return false;
}

function isPlaceholder(value) {
  // Common placeholder patterns used in this repo's docs
  if (/x{8,}/i.test(value)) return true;
  if (/y{6,}/i.test(value)) return true;
  if (/REPLACE_ME/i.test(value)) return true;
  if (/your[_-]?api[_-]?key/i.test(value)) return true;
  return false;
}

function walk(dirAbs, relBase = '') {
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const abs = path.join(dirAbs, entry.name);
    const rel = path.join(relBase, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      results.push(...walk(abs, rel));
      continue;
    }

    if (!isTextFile(abs)) continue;
    if (isExcludedFile(rel)) continue;

    results.push({ abs, rel });
  }

  return results;
}

function findMatches(content, regex) {
  const matches = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.push({ index: match.index, match: match[0], groups: match.groups || {} });
  }
  return matches;
}

function getLineInfo(content, index) {
  const upTo = content.slice(0, index);
  const lineNumber = upTo.split(/\r?\n/).length;
  const lineStart = upTo.lastIndexOf('\n') + 1;
  const lineEnd = content.indexOf('\n', index);
  const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
  return { lineNumber, line: line.trimEnd() };
}

function validate() {
  const files = walk(WORKSPACE_ROOT);

  /**
   * Matches:
   * - AdMob app id: ca-app-pub-<16 digits>~<10 digits>
   * - Ad unit id: ca-app-pub-<16 digits>/<10 digits>
   */
  const admobIdRegex = /ca-app-pub-(?<publisher>\d{16})(?<suffix>[~/]\d{10})/g;
  // Avoid matching the "pub-<digits>" substring inside "ca-app-pub-<digits>"
  const publisherIdRegex = /(?<!ca-app-)\bpub-(?<publisher>\d{16})\b/g;

  // Google API key format (Firebase Web API key, Maps API key, etc)
  const googleApiKeyRegex = /\bAIza[0-9A-Za-z\-_]{35}\b/g;

  const findings = [];

  for (const file of files) {
    const content = fs.readFileSync(file.abs, 'utf8');

    for (const m of findMatches(content, admobIdRegex)) {
      const publisher = m.groups.publisher;
      if (ALLOWED_ADMOB_PUBLISHER_IDS.has(publisher)) continue;
      if (isPlaceholder(m.match)) continue;

      const { lineNumber, line } = getLineInfo(content, m.index);
      findings.push({
        type: 'AdMob ID',
        relPath: file.rel,
        lineNumber,
        value: m.match,
        line,
      });
    }

    for (const m of findMatches(content, publisherIdRegex)) {
      const publisher = m.groups.publisher;
      if (ALLOWED_ADMOB_PUBLISHER_IDS.has(publisher)) continue;
      if (isPlaceholder(m.match)) continue;

      const { lineNumber, line } = getLineInfo(content, m.index);
      findings.push({
        type: 'AdMob Publisher ID',
        relPath: file.rel,
        lineNumber,
        value: m.match,
        line,
      });
    }

    // Allow google-services.json explicitly
    if (file.rel === 'google-services.json') continue;

    for (const m of findMatches(content, googleApiKeyRegex)) {
      if (isPlaceholder(m.match)) continue;

      const { lineNumber, line } = getLineInfo(content, m.index);
      findings.push({
        type: 'Google API Key',
        relPath: file.rel,
        lineNumber,
        value: m.match,
        line,
      });
    }
  }

  if (findings.length > 0) {
    console.error('❌ validate:secrets: Potential sensitive literals found');
    for (const f of findings) {
      console.error(`- ${f.type}: ${f.relPath}:${f.lineNumber}`);
      console.error(`  ${f.line}`);
    }
    console.error('\nFix: move values to env/EAS secrets and use placeholders in docs.');
    process.exit(1);
  }

  console.log('✅ validate:secrets: passed (no sensitive literals detected)');
}

if (require.main === module) {
  try {
    validate();
  } catch (err) {
    console.error('❌ validate:secrets: failed with unexpected error');
    console.error(err);
    process.exit(1);
  }
}
