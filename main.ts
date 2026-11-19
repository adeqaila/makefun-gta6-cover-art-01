// Vice Lights Cover Studio — hand-in program (Node 22, standard library
// only). It copies this repo's app/ and screenshots/ into the output
// directory and writes /output/dossier.json with the vendored make.fun
// library, exactly as the kit asks.
//
// Grader safety: the grader runs as an unprivileged user with /output as a
// mount, so this program NEVER removes the output directory itself —
// deleting it fails with EPERM and the entry is rejected. Instead it
// creates the directory, then clears only the children of the two folders
// it owns (app/ and screenshots/) one by one. Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Remove every child of `dir`, but never `dir` itself.
function clearChildren(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    rmSync(join(dir, name), { recursive: true, force: true });
  }
}

mkdirSync(outDir, { recursive: true });

const outApp = join(outDir, 'app');
mkdirSync(outApp, { recursive: true });
clearChildren(outApp);
cpSync(join(here, 'app'), outApp, { recursive: true });

const outShots = join(outDir, 'screenshots');
mkdirSync(outShots, { recursive: true });
clearChildren(outShots);
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), outShots, { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB
// of app files in all, or a path under app/ over 1000 bytes).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`wrote ${outDir} (dossier ${dossier.length} bytes)`);
