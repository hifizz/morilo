// prepare-runtime.mjs — stage a bundled Node + pinned Pi runtime into
// resources/darwin-<arch>/runtime. Everything is verified against the
// authored manifest before it is cached or installed.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, cpSync, createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url));
const arch = process.argv[2] || ({ arm64: 'arm64', x64: 'amd64' })[process.arch];
const nodeArch = ({ arm64: 'arm64', amd64: 'x64' })[arch];
if (process.platform !== 'darwin' || !nodeArch) throw new Error('Runtime packaging supports macOS arm64 or amd64');
const version = readFileSync(join(root, '.node-version'), 'utf8').trim();
const filename = `node-v${version}-darwin-${nodeArch}.tar.gz`;
const checksums = JSON.parse(readFileSync(join(root, 'runtime/node-checksums.json'), 'utf8'));
if (!checksums[filename]) throw new Error('Missing pinned Node checksum');
const url = `https://nodejs.org/dist/v${version}/${filename}`;
const destination = join(root, `resources/darwin-${arch}/runtime`);

const cacheDir = join(root, '.mygo/runtime-cache');
mkdirSync(cacheDir, { recursive: true });
const cacheFile = join(cacheDir, filename);
const staging = mkdtempSync(join(cacheDir, 'stage-'));

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

async function download() {
  console.log(`Downloading ${url}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  const tmp = cacheFile + '.tmp';
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok || !res.body) throw new Error(`Node download failed: HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
    if (sha256(tmp) !== checksums[filename]) {
      throw new Error(`SHA256 mismatch for ${filename}`);
    }
    renameSync(tmp, cacheFile);
  } finally {
    clearTimeout(timer);
    rmSync(tmp, { force: true });
  }
}

async function verifiedArchive() {
  if (!existsSync(cacheFile) || sha256(cacheFile) !== checksums[filename]) {
    rmSync(cacheFile, { force: true });
    await download();
  }
  return cacheFile;
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} exited ${result.status}`);
}

async function main() {
  const archive = await verifiedArchive();
  const stageRuntime = join(staging, 'runtime');
  mkdirSync(join(stageRuntime, 'bin'), { recursive: true });

  // Extract only the official node binary + license from the tarball.
  const extract = join(staging, 'extract');
  mkdirSync(extract, { recursive: true });
  run('tar', ['-xzf', archive, '-C', extract, `node-v${version}-darwin-${nodeArch}/bin/node`, `node-v${version}-darwin-${nodeArch}/LICENSE`]);
  const nodeSrc = join(extract, `node-v${version}-darwin-${nodeArch}/bin/node`);
  const licenseSrc = join(extract, `node-v${version}-darwin-${nodeArch}/LICENSE`);
  cpSync(nodeSrc, join(stageRuntime, 'bin/node'));
  chmodSync(join(stageRuntime, 'bin/node'), 0o755);
  cpSync(licenseSrc, join(stageRuntime, 'NODE-LICENSE'));

  // Install the pinned Pi package set from the frozen lockfile.
  cpSync(join(root, 'runtime/package.json'), join(stageRuntime, 'package.json'));
  cpSync(join(root, 'runtime/package-lock.json'), join(stageRuntime, 'package-lock.json'));
  run('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--os=darwin', `--cpu=${nodeArch}`], { cwd: stageRuntime });

  // mygo's bundle copy skips dotfiles; pi-ai needs this manifest at runtime,
  // so ship it under a non-hidden name and point the single import at it.
  const manifest = join(stageRuntime, 'node_modules/@earendil-works/pi-ai/dist/providers/data/.manifest.json');
  const manifestTarget = join(stageRuntime, 'node_modules/@earendil-works/pi-ai/dist/providers/data/manifest.json');
  const importer = join(stageRuntime, 'node_modules/@earendil-works/pi-ai/dist/providers/all.js');
  if (existsSync(manifest)) {
    renameSync(manifest, manifestTarget);
    const source = readFileSync(importer, 'utf8');
    if (!source.includes('/data/.manifest.json')) throw new Error('pi-ai manifest import path changed; update prepare-runtime');
    writeFileSync(importer, source.replace('/data/.manifest.json', '/data/manifest.json'));
  }

  // Third-party notices from the frozen lock.
  const lock = JSON.parse(readFileSync(join(stageRuntime, 'package-lock.json'), 'utf8'));
  const notices = ['Morilo bundled runtime third-party packages', ''];
  for (const [path, meta] of Object.entries(lock.packages ?? {})) {
    if (!path || !meta.version) continue;
    const pkgJson = join(stageRuntime, path, 'package.json');
    let license = meta.license ?? '';
    if (!license && existsSync(pkgJson)) {
      try { license = JSON.parse(readFileSync(pkgJson, 'utf8')).license ?? '' } catch { /* keep empty */ }
    }
    notices.push(`${path}@${meta.version}${license ? ` (${license})` : ''}`);
  }
  writeFileSync(join(stageRuntime, 'THIRD-PARTY-NOTICES.txt'), notices.join('\n') + '\n');

  // Validate the staged runtime before swapping it in.
  const cli = join(stageRuntime, 'node_modules/@earendil-works/pi-coding-agent/dist/cli.js');
  for (const required of [join(stageRuntime, 'bin/node'), cli]) {
    if (!existsSync(required) || !statSync(required).isFile()) {
      throw new Error(`Staged runtime is missing ${required}`);
    }
  }

  mkdirSync(join(root, `resources/darwin-${arch}`), { recursive: true });
  const backup = destination + '.previous';
  rmSync(backup, { recursive: true, force: true });
  if (existsSync(destination)) renameSync(destination, backup);
  try {
    renameSync(stageRuntime, destination);
  } catch (err) {
    if (existsSync(backup)) renameSync(backup, destination);
    throw err;
  }
  rmSync(backup, { recursive: true, force: true });
  console.log(`Bundled runtime ready at ${destination}`);
}

main()
  .catch((err) => { console.error(`prepare-runtime failed: ${err.message}`); process.exitCode = 1 })
  .finally(() => rmSync(staging, { recursive: true, force: true }));
