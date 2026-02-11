import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ENV_FILES = ['.env', '.env.local'];
const ENV_KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

function resolveValue(rawValue: string): string {
  const value = rawValue.trim();

  if (value.startsWith('"') && value.endsWith('"')) {
    const inner = value.slice(1, -1);
    return inner
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  // Strip inline comments for unquoted values (e.g., KEY=value # comment).
  const commentIndex = value.indexOf(' #');
  return commentIndex >= 0 ? value.slice(0, commentIndex).trim() : value;
}

function parseLine(rawLine: string): { key: string; value: string } | null {
  let line = rawLine.trim();
  if (!line || line.startsWith('#')) {
    return null;
  }

  if (line.startsWith('\uFEFF')) {
    line = line.slice(1);
  }

  if (line.startsWith('export ')) {
    line = line.slice(7).trimStart();
  }

  const equalsIndex = line.indexOf('=');
  if (equalsIndex <= 0) {
    return null;
  }

  const key = line.slice(0, equalsIndex).trim();
  if (!ENV_KEY_REGEX.test(key)) {
    return null;
  }

  const value = resolveValue(line.slice(equalsIndex + 1));
  return { key, value };
}

/**
 * Load env vars from .env files in cwd.
 * - Existing process env vars are never overwritten.
 * - .env.local can override values coming from .env.
 */
export function loadEnvFromCwd(cwd = process.cwd()): void {
  const initialProcessEnvKeys = new Set(Object.keys(process.env));
  const loadedFromFile = new Set<string>();

  for (const file of ENV_FILES) {
    const path = join(cwd, file);
    if (!existsSync(path)) {
      continue;
    }

    const content = readFileSync(path, 'utf8');
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const parsed = parseLine(line);
      if (!parsed) {
        continue;
      }

      // Respect shell-exported vars. Allow .env.local to override .env-loaded values.
      if (initialProcessEnvKeys.has(parsed.key) && !loadedFromFile.has(parsed.key)) {
        continue;
      }

      process.env[parsed.key] = parsed.value;
      loadedFromFile.add(parsed.key);
    }
  }
}

