import { readdir } from 'node:fs/promises';
import path from 'node:path';

const ignored = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', 'playwright-report', 'test-results']);
const sourceExtensions = new Set(['.ts', '.tsx']);
const generatedExtensions = new Set(['.js', '.jsx']);
const seen = new Map();

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    const extension = path.extname(entry.name);
    if (!sourceExtensions.has(extension) && !generatedExtensions.has(extension)) continue;
    const key = fullPath.slice(0, -extension.length);
    const record = seen.get(key) || { sources: [], generated: [] };
    (sourceExtensions.has(extension) ? record.sources : record.generated).push(fullPath);
    seen.set(key, record);
  }
}

await walk(process.cwd());
const twins = [...seen.values()].filter((record) => record.sources.length && record.generated.length);
if (twins.length) {
  console.error('Generated JavaScript twins shadow TypeScript sources:');
  for (const twin of twins) {
    console.error([...twin.sources, ...twin.generated].map((file) => path.relative(process.cwd(), file)).join(' | '));
  }
  process.exit(1);
}
console.log('No generated JavaScript twins shadow TypeScript sources.');

