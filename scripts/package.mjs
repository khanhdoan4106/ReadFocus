import { readdir, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = fileURLToPath(new URL('..', import.meta.url));
const distDir = path.join(root, 'dist');
const releaseDir = path.join(root, 'release');

async function readJson(relativePath) {
  const raw = await readFile(path.join(root, relativePath), 'utf8');
  return JSON.parse(raw);
}

async function collectFiles(directory, base = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = {};

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      Object.assign(files, await collectFiles(absolutePath, base));
    } else if (entry.isFile()) {
      const relativePath = path.relative(base, absolutePath).split(path.sep).join('/');
      files[relativePath] = new Uint8Array(await readFile(absolutePath));
    }
  }

  return files;
}

const pkg = await readJson('package.json');

if (!existsSync(distDir)) {
  console.error('Chưa có thư mục dist/. Chạy `npm run build` trước khi đóng gói.');
  process.exit(1);
}

const builtManifestPath = path.join(distDir, 'manifest.json');
if (!existsSync(builtManifestPath)) {
  console.error('Không thấy dist/manifest.json. Bản build chưa hợp lệ.');
  process.exit(1);
}

const builtManifest = JSON.parse(await readFile(builtManifestPath, 'utf8'));
if (builtManifest.version !== pkg.version) {
  console.error(
    `Phiên bản lệch: package.json ${pkg.version} ≠ manifest.json ${builtManifest.version}.`,
  );
  process.exit(1);
}

const files = await collectFiles(distDir);
const archive = zipSync(files, { level: 9 });

await mkdir(releaseDir, { recursive: true });
const zipName = `readfocus-v${pkg.version}.zip`;
await writeFile(path.join(releaseDir, zipName), archive);

console.log(`Đã đóng gói release/${zipName} (${Object.keys(files).length} file).`);
