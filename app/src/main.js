// Vice Lights Cover Studio — page wiring: photo slots, pickers, caption
// editing, drag-to-pan per panel, undo/redo and PNG export. A `?shot=`
// query instead loads a fixed scene for a screenshot (see shots.js).

import {
  paintCover, panelsFor, panelCount, parseExportSize,
  POSTERS, POSTER_NAMES, TINTS, TINT_NAMES, EXPORT_SIZES, EXPORT_NAMES,
} from './cover.js';
import { playShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusLine = document.getElementById('status');

const SAMPLES = [
  { label: 'Pier', src: 'samples/pier.jpg' },
  { label: 'Boulevard', src: 'samples/boulevard.jpg' },
  { label: 'Neon', src: 'samples/neon.jpg' },
  { label: 'Sunset', src: 'samples/sunset.jpg' },
];

const freshPanels = () => [
  { photo: 0, zoom: 1, cx: 0, cy: 0 },
  { photo: 1, zoom: 1, cx: 0, cy: 0.35 },
  { photo: 2, zoom: 1.2, cx: 0, cy: 0.35 },
  { photo: 3, zoom: 1.2, cx: 0, cy: 0.35 },
  { photo: 0, zoom: 1.3, cx: 0, cy: 0 },
  { photo: 1, zoom: 1.3, cx: 0, cy: 0.35 },
  { photo: 2, zoom: 1.4, cx: 0, cy: 0.35 },
  { photo: 3, zoom: 1.4, cx: 0, cy: 0.35 },
  { photo: 0, zoom: 1.5, cx: 0, cy: 0 },
];

function freshState() {
  return {
    layout: 'hero3',
    grade: 'sunset',
    size: '1080x1080',
    photos: SAMPLES.map((s) => ({ ...s })),
    panels: freshPanels(),
    title: 'Sunset Heist',
    tagline: 'Vice Lights',
    titleStyle: 'sunset',
    badge: 'HOT',
    heat: 5,
    grain: true,
    vignette: true,
    halftone: true,
    picked: 0,
  };
}

let cover = freshState();
const loaded = new Map(); // photo index -> HTMLImageElement
let past = [];
let coming = [];

function checkpoint() {
  past.push(JSON.stringify(cover));
  if (past.length > 20) past.shift();
  coming = [];
  refreshUndo();
}

function applySnapshot(json) {
  cover = JSON.parse(json);
  syncAll();
  paint();
}

function stepBack() {
  if (!past.length) return;
  coming.push(JSON.stringify(cover));
  applySnapshot(past.pop());
  refreshUndo();
}

function stepForward() {
  if (!coming.length) return;
  past.push(JSON.stringify(cover));
  applySnapshot(coming.pop());
  refreshUndo();
}

function refreshUndo() {
  document.getElementById('undo').disabled = past.length === 0;
  document.getElementById('redo').disabled = coming.length === 0;
}

export function loadImg(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadAllPhotos() {
  loaded.clear();
  await Promise.all(
    cover.photos.map(async (photo, i) => {
      try {
        loaded.set(i, await loadImg(photo.src));
      } catch {
        loaded.delete(i);
      }
    }),
  );
}

// The editor preview keeps the cover's aspect with a 720px long side.
function previewDims() {
  const { w, h } = parseExportSize(cover.size);
  const scale = 720 / Math.max(w, h);
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

function paint() {
  if (!coverShot) {
    const { w, h } = previewDims();
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    canvas.style.aspectRatio = `${w} / ${h}`;
  }
  paintCover(canvas, cover, loaded);
}

// Renders at full export size and downloads the PNG.
async function downloadPng() {
  const { w, h } = parseExportSize(cover.size);
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  paintCover(off, cover, loaded);
  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `vice-lights-${cover.size}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  statusLine.textContent = `Saved vice-lights-${cover.size}.png (${w} × ${h}).`;
}

// --- Controls --------------------------------------------------------------

function chipRow(el, values, names, current, apply) {
  el.innerHTML = '';
  for (const value of values) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pick' + (value === current ? ' active' : '');
    btn.textContent = names[value] ?? value;
    btn.addEventListener('click', () => {
      checkpoint();
      apply(value);
      chipRow(el, values, names, value, apply);
      paint();
    });
    el.appendChild(btn);
  }
}

function syncAll() {
  chipRow(document.getElementById('layouts'), POSTERS, POSTER_NAMES, cover.layout, (v) => { cover.layout = v; });
  chipRow(document.getElementById('grades'), TINTS, TINT_NAMES, cover.grade, (v) => { cover.grade = v; });
  chipRow(document.getElementById('sizes'), EXPORT_SIZES, EXPORT_NAMES, cover.size, (v) => { cover.size = v; });
  document.getElementById('title').value = cover.title;
  document.getElementById('tagline').value = cover.tagline;
  document.getElementById('titleStyle').value = cover.titleStyle;
  document.getElementById('badge').value = cover.badge;
  document.getElementById('heat').value = String(cover.heat);
  document.getElementById('heatValue').textContent = `★ ${cover.heat}/5`;
  document.getElementById('grain').checked = cover.grain;
  document.getElementById('vignette').checked = cover.vignette;
  document.getElementById('halftone').checked = cover.halftone;
  syncSlots();
  syncPanelBox();
}

function syncSlots() {
  const wrap = document.getElementById('photoSlots');
  wrap.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const photo = cover.photos[i];
    const slot = document.createElement('div');
    slot.className = 'photo-slot';
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (photo) {
      const img = document.createElement('img');
      img.src = photo.src;
      img.alt = photo.label;
      thumb.appendChild(img);
    } else {
      thumb.textContent = '＋';
    }
    const label = document.createElement('span');
    label.textContent = photo ? `Photo ${i + 1} · ${photo.label}` : `Photo ${i + 1} · empty`;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.id = `photoFile${i}`;
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      checkpoint();
      cover.photos[i] = { label: file.name.replace(/\.[^.]+$/, '').slice(0, 18) || 'Upload', src: dataUrl };
      await loadAllPhotos();
      syncSlots();
      syncPanelBox();
      paint();
    });
    const sampleBtn = document.createElement('button');
    sampleBtn.type = 'button';
    sampleBtn.className = 'mini';
    sampleBtn.textContent = 'Sample';
    sampleBtn.addEventListener('click', async () => {
      checkpoint();
      cover.photos[i] = { ...SAMPLES[i % SAMPLES.length] };
      await loadAllPhotos();
      syncSlots();
      syncPanelBox();
      paint();
    });
    slot.append(thumb, label, input, sampleBtn);
    wrap.appendChild(slot);
  }
}

function syncPanelBox() {
  const sel = document.getElementById('panelPhoto');
  const count = panelCount(cover.layout, 100, 100);
  const panel = cover.panels[cover.picked] || { photo: -1, zoom: 1, cx: 0, cy: 0 };
  sel.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '-1';
  empty.textContent = 'Empty panel';
  sel.appendChild(empty);
  cover.photos.forEach((photo, i) => {
    if (!photo) return;
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `Photo ${i + 1} · ${photo.label}`;
    sel.appendChild(opt);
  });
  sel.value = String(panel.photo);
  document.getElementById('panelLabel').textContent = `Panel ${cover.picked + 1} of ${count}`;
  document.getElementById('zoom').value = String(panel.zoom || 1);
  document.getElementById('zoomValue').textContent = `${Math.round((panel.zoom || 1) * 100)}%`;
}

// --- Panel picking: click selects, drag pans the photo inside its panel ----

let drag = null;

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function panelAt(p) {
  const rects = panelsFor(cover.layout, canvas.width, canvas.height);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return i;
  }
  return -1;
}

canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const i = panelAt(p);
  if (i < 0) return;
  canvas.setPointerCapture(e.pointerId);
  drag = { panel: i, start: p, moved: false, slot: { ...cover.panels[i] } };
  if (cover.picked !== i) {
    cover.picked = i;
    syncPanelBox();
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const dx = p.x - drag.start.x;
  const dy = p.y - drag.start.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
  if (!drag.moved) return;
  const rects = panelsFor(cover.layout, canvas.width, canvas.height);
  const rect = rects[drag.panel];
  const img = loaded.get(drag.slot.photo);
  const slot = cover.panels[drag.panel];
  if (img && slot) {
    const zoom = slot.zoom || 1;
    const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
    const sw = img.naturalWidth * base * zoom;
    const sh = img.naturalHeight * base * zoom;
    slot.cx = Math.max(-1, Math.min(1, drag.slot.cx + (sw > rect.w ? (2 * dx) / (sw - rect.w) : 0)));
    slot.cy = Math.max(-1, Math.min(1, drag.slot.cy + (sh > rect.h ? (2 * dy) / (sh - rect.h) : 0)));
    paint();
  }
});

canvas.addEventListener('pointerup', () => {
  if (drag?.moved) checkpoint();
  drag = null;
});

// --- Static wiring ---------------------------------------------------------

document.getElementById('undo').addEventListener('click', stepBack);
document.getElementById('redo').addEventListener('click', stepForward);
document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const key = e.key.toLowerCase();
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault();
    stepBack();
  } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
    e.preventDefault();
    stepForward();
  }
});
document.getElementById('export').addEventListener('click', downloadPng);

function bindText(id, key) {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    cover[key] = el.value;
    paint();
  });
  el.addEventListener('change', checkpoint);
}
bindText('title', 'title');
bindText('tagline', 'tagline');

document.getElementById('titleStyle').addEventListener('change', (e) => {
  checkpoint();
  cover.titleStyle = e.target.value;
  paint();
});
document.getElementById('badge').addEventListener('change', (e) => {
  checkpoint();
  cover.badge = e.target.value;
  paint();
});
document.getElementById('heat').addEventListener('input', (e) => {
  cover.heat = Number(e.target.value);
  document.getElementById('heatValue').textContent = `★ ${cover.heat}/5`;
  paint();
});
document.getElementById('heat').addEventListener('change', checkpoint);

for (const [id, key] of [['grain', 'grain'], ['vignette', 'vignette'], ['halftone', 'halftone']]) {
  document.getElementById(id).addEventListener('change', (e) => {
    checkpoint();
    cover[key] = e.target.checked;
    paint();
  });
}

document.getElementById('panelPhoto').addEventListener('change', (e) => {
  checkpoint();
  cover.panels[cover.picked].photo = Number(e.target.value);
  paint();
});
document.getElementById('zoom').addEventListener('input', (e) => {
  cover.panels[cover.picked].zoom = Number(e.target.value);
  document.getElementById('zoomValue').textContent = `${Math.round(Number(e.target.value) * 100)}%`;
  paint();
});
document.getElementById('zoom').addEventListener('change', checkpoint);
document.getElementById('resetPanel').addEventListener('click', () => {
  checkpoint();
  const keep = cover.panels[cover.picked].photo;
  cover.panels[cover.picked] = { ...freshPanels()[cover.picked], photo: keep };
  syncPanelBox();
  paint();
});

// --- Boot ------------------------------------------------------------------

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
// In cover-shot mode the canvas keeps the size shots.js gives it (the
// viewport), instead of the editor's 720px preview size.
let coverShot = shotName === 'cover';

async function boot() {
  // Fonts first: the cover's lettering is Anton + Pacifico, vendored locally.
  try {
    await Promise.race([
      Promise.all([document.fonts.load('80px Anton'), document.fonts.load('40px Pacifico'), document.fonts.ready]),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
  } catch { /* fall back to system fonts */ }
  await loadAllPhotos();
  syncAll();
  refreshUndo();
  paint();
  if (shotName) {
    await playShot(shotName, params, {
      setState(patch) {
        checkpoint();
        Object.assign(cover, patch);
      },
      async setPhotos(photos) {
        cover.photos = photos;
        await loadAllPhotos();
      },
      paint,
      syncAll,
    });
  }
}

boot();
