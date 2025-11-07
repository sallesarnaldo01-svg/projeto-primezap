import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(projectRoot, '../../apps/api/dist');
const EXT_WHITELIST = new Set(['.js', '.mjs', '.cjs', '.json', '.node']);

const fromRegex = /from\s+(['"])(\.{1,2}\/[^'"]+)\1/g;
const importRegex = /import\(\s*(['"])(\.{1,2}\/[^'"]+)\1\s*\)/g;

function ensureJsExtension(specifier) {
  const ext = path.extname(specifier);
  if (!ext || !EXT_WHITELIST.has(ext)) {
    return `${specifier}.js`;
  }
  return specifier;
}

function patchContent(content) {
  let next = content.replace(fromRegex, (match, quote, spec) => {
    return `from ${quote}${ensureJsExtension(spec)}${quote}`;
  });
  next = next.replace(importRegex, (match, quote, spec) => {
    return `import(${quote}${ensureJsExtension(spec)}${quote})`;
  });
  return next;
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const original = await readFile(fullPath, 'utf8');
      const patched = patchContent(original);
      if (patched !== original) {
        await writeFile(fullPath, patched, 'utf8');
      }
    }
  }
}

const distExists = await stat(distDir).then(() => true).catch(() => false);
if (!distExists) {
  console.error(`Cannot find dist directory at ${distDir}. Run the API build before calling this script.`);
  process.exit(1);
}

await walk(distDir);
