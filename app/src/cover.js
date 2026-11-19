// Vice Lights Cover Studio — poster engine.
//
// Draws a multi-panel GTA-style cover on a 2D canvas: panel layouts, a
// per-pixel gradient-map colour grade, deterministic film grain, a vignette,
// a halftone title band, a ribbon badge and a heat meter. Everything is
// local and deterministic: the same state always paints the same pixels.

export const POSTERS = ['hero3', 'grid4', 'full', 'nine', 'strip', 'tilt'];
export const POSTER_NAMES = {
  hero3: 'Hero + 3',
  grid4: 'Grid 4',
  full: 'Full bleed',
  nine: 'Nine grid',
  strip: 'Triple strip',
  tilt: 'Tilted snaps',
};

export const TINTS = ['sunset', 'neon', 'noir', 'palm', 'candy'];
export const TINT_NAMES = {
  sunset: 'Sunset',
  neon: 'Neon',
  noir: 'Noir',
  palm: 'Palm',
  candy: 'Candy',
};

export const EXPORT_SIZES = ['1080x1080', '1080x1350', '1920x1080', '1080x1920'];
export const EXPORT_NAMES = {
  '1080x1080': 'Square · 1080 × 1080',
  '1080x1350': 'Portrait · 1080 × 1350',
  '1920x1080': 'Landscape · 1920 × 1080',
  '1080x1920': 'Story · 1080 × 1920',
};

export function parseExportSize(code) {
  const parts = String(code).split('x');
  return { w: Number(parts[0]) || 1080, h: Number(parts[1]) || 1080 };
}

// Each stop is [luminance, [r, g, b]]; the tint table interpolates between
// them, so a photo's brightness is remapped onto the poster's palette.
const TINT_STOPS = {
  sunset: [
    [0, [22, 8, 34]],
    [0.22, [110, 30, 74]],
    [0.48, [238, 96, 66]],
    [0.74, [255, 166, 82]],
    [1, [255, 244, 214]],
  ],
  neon: [
    [0, [6, 12, 46]],
    [0.24, [72, 22, 118]],
    [0.5, [255, 52, 142]],
    [0.76, [86, 214, 255]],
    [1, [238, 253, 255]],
  ],
  noir: [
    [0, [2, 2, 4]],
    [0.26, [26, 26, 30]],
    [0.52, [134, 134, 138]],
    [0.78, [226, 226, 230]],
    [1, [255, 255, 255]],
  ],
  palm: [
    [0, [6, 32, 26]],
    [0.24, [14, 104, 72]],
    [0.5, [48, 166, 112]],
    [0.76, [176, 228, 104]],
    [1, [244, 255, 236]],
  ],
  candy: [
    [0, [38, 10, 48]],
    [0.24, [118, 26, 126]],
    [0.5, [204, 84, 255]],
    [0.76, [255, 164, 228]],
    [1, [255, 242, 251]],
  ],
};

// Panel rectangles for one poster at w x h. `spin` is a tilt in degrees.
export function panelsFor(poster, w, h) {
  const gap = Math.max(2, Math.round(Math.min(w, h) * 0.012));
  const box = (x, y, pw, ph, spin = 0) => ({ x, y, w: pw, h: ph, spin });
  if (poster === 'grid4') {
    const cw = (w - gap) / 2;
    const ch = (h - gap) / 2;
    return [
      box(0, 0, cw, ch),
      box(cw + gap, 0, cw, ch),
      box(0, ch + gap, cw, ch),
      box(cw + gap, ch + gap, cw, ch),
    ];
  }
  if (poster === 'full') return [box(0, 0, w, h)];
  if (poster === 'nine') {
    const cw = (w - 2 * gap) / 3;
    const ch = (h - 2 * gap) / 3;
    const out = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        out.push(box(col * (cw + gap), row * (ch + gap), cw, ch));
      }
    }
    return out;
  }
  if (poster === 'strip') {
    const cw = (w - 2 * gap) / 3;
    return [box(0, 0, cw, h), box(cw + gap, 0, cw, h), box(2 * (cw + gap), 0, cw, h)];
  }
  if (poster === 'tilt') {
    const edge = Math.round(w * 0.06);
    const cw = (w - 2 * edge - gap) / 2;
    const ch = (h - 2 * edge - gap) / 2;
    return [
      box(edge, edge, cw, ch, -4),
      box(edge + cw + gap, edge, cw, ch, 3),
      box(edge, edge + ch + gap, cw, ch, 3),
      box(edge + cw + gap, edge + ch + gap, cw, ch, -3),
    ];
  }
  // hero3: one big hero panel plus three smaller ones.
  if (w >= h) {
    const heroW = Math.round(w * 0.6);
    const sideW = w - heroW - gap;
    const ch = (h - 2 * gap) / 3;
    return [
      box(0, 0, heroW, h),
      box(heroW + gap, 0, sideW, ch),
      box(heroW + gap, ch + gap, sideW, ch),
      box(heroW + gap, 2 * (ch + gap), sideW, ch),
    ];
  }
  const heroH = Math.round(h * 0.56);
  const rowH = h - heroH - gap;
  const cw = (w - 2 * gap) / 3;
  return [
    box(0, 0, w, heroH),
    box(0, heroH + gap, cw, rowH),
    box(cw + gap, heroH + gap, cw, rowH),
    box(2 * (cw + gap), heroH + gap, cw, rowH),
  ];
}

// How many panels a poster has at w x h (the hero3 count never changes
// with orientation, but the helper keeps callers from re-deriving it).
export function panelCount(poster, w, h) {
  return panelsFor(poster, w, h).length;
}

// --- Gradient-map tint -----------------------------------------------------

const tintTables = new Map();

function tintTable(tint) {
  const hit = tintTables.get(tint);
  if (hit) return hit;
  const stops = TINT_STOPS[tint] || TINT_STOPS.sunset;
  const table = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let lo = stops[0];
    let hi = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) {
        lo = stops[s];
        hi = stops[s + 1];
        break;
      }
    }
    const span = hi[0] - lo[0];
    const f = span === 0 ? 0 : (t - lo[0]) / span;
    for (let c = 0; c < 3; c++) {
      table[i * 3 + c] = Math.round(lo[1][c] + (hi[1][c] - lo[1][c]) * f);
    }
  }
  tintTables.set(tint, table);
  return table;
}

// Remaps every pixel of the given rectangle through the tint table.
export function gradeRegion(ctx, x, y, w, h, tint) {
  const frame = ctx.getImageData(x, y, w, h);
  const px = frame.data;
  const table = tintTable(tint);
  for (let i = 0; i < px.length; i += 4) {
    const lum = Math.round(0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]);
    const o = lum * 3;
    px[i] = table[o];
    px[i + 1] = table[o + 1];
    px[i + 2] = table[o + 2];
  }
  ctx.putImageData(frame, x, y);
}

// --- Grain and vignette ----------------------------------------------------

let speckleTile = null;

function speckleCanvas() {
  if (speckleTile) return speckleTile;
  const side = 96;
  const tile = document.createElement('canvas');
  tile.width = side;
  tile.height = side;
  const tctx = tile.getContext('2d');
  const frame = tctx.createImageData(side, side);
  let seed = 20261119;
  for (let i = 0; i < frame.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const v = (seed >>> 16) & 255;
    frame.data[i] = v;
    frame.data[i + 1] = v;
    frame.data[i + 2] = v;
    frame.data[i + 3] = 255;
  }
  tctx.putImageData(frame, 0, 0);
  speckleTile = tile;
  return tile;
}

export function paintGrain(ctx, w, h) {
  const pattern = ctx.createPattern(speckleCanvas(), 'repeat');
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function paintVignette(ctx, w, h) {
  const glow = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.4,
    w / 2, h / 2, Math.max(w, h) * 0.78,
  );
  glow.addColorStop(0, 'rgba(0,0,0,0)');
  glow.addColorStop(1, 'rgba(10,2,18,0.4)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

// --- Photos ----------------------------------------------------------------

// Cover-fit an image into a panel, honouring zoom and pan (px, py in -1..1).
export function placeImage(img, rect, panel) {
  const zoom = panel.zoom || 1;
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const dw = img.naturalWidth * scale * zoom;
  const dh = img.naturalHeight * scale * zoom;
  const slackX = Math.max(0, (dw - rect.w) / 2);
  const slackY = Math.max(0, (dh - rect.h) / 2);
  return {
    x: rect.x + (rect.w - dw) / 2 + (panel.cx || 0) * slackX,
    y: rect.y + (rect.h - dh) / 2 + (panel.cy || 0) * slackY,
    w: dw,
    h: dh,
  };
}

export function paintPanel(ctx, img, rect, panel, tint, poster) {
  const w = Math.round(rect.w);
  const h = Math.round(rect.h);
  ctx.save();
  if (rect.spin) {
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate((rect.spin * Math.PI) / 180);
    ctx.translate(-rect.w / 2, -rect.h / 2);
  } else {
    ctx.translate(rect.x, rect.y);
  }
  if (poster === 'tilt') {
    // A white polaroid border around each tilted snap.
    ctx.fillStyle = '#fbf6ea';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = Math.max(6, w * 0.03);
    ctx.shadowOffsetY = Math.max(3, h * 0.02);
    ctx.fillRect(-w * 0.035, -h * 0.035, w * 1.07, h * 1.07);
    ctx.shadowColor = 'transparent';
  }
  if (img) {
    const layer = document.createElement('canvas');
    layer.width = Math.max(2, w);
    layer.height = Math.max(2, h);
    const lctx = layer.getContext('2d');
    const spot = placeImage(img, { x: 0, y: 0, w, h }, panel);
    lctx.drawImage(img, spot.x, spot.y, spot.w, spot.h);
    gradeRegion(lctx, 0, 0, layer.width, layer.height, tint);
    ctx.drawImage(layer, 0, 0);
  } else {
    const empty = ctx.createLinearGradient(0, 0, 0, h);
    empty.addColorStop(0, '#2c1e40');
    empty.addColorStop(1, '#140a20');
    ctx.fillStyle = empty;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.setLineDash([Math.max(4, w * 0.02), Math.max(4, w * 0.02)]);
    ctx.lineWidth = Math.max(1, w * 0.004);
    ctx.strokeRect(w * 0.06, h * 0.06, w * 0.88, h * 0.88);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `${Math.max(12, Math.round(h * 0.09))}px Anton, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADD A PHOTO', w / 2, h / 2);
  }
  ctx.strokeStyle = 'rgba(12,4,22,0.55)';
  ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.004);
  ctx.strokeRect(0, 0, w, h);
  ctx.restore();
}

// --- Caption band, halftone, ribbon ----------------------------------------

function captionFill(ctx, mode, bandY, bandH) {
  if (mode === 'white') return '#ffffff';
  const wash = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  if (mode === 'neon') {
    wash.addColorStop(0, '#82f4ff');
    wash.addColorStop(0.55, '#ff2e88');
    wash.addColorStop(1, '#b44dff');
  } else {
    wash.addColorStop(0, '#ffecA6');
    wash.addColorStop(0.5, '#ff8a3c');
    wash.addColorStop(1, '#ff2e88');
  }
  return wash;
}

function taglineInk(mode) {
  if (mode === 'neon') return '#82f4ff';
  if (mode === 'white') return '#ffffff';
  return '#ffd76a';
}

export function paintHalftone(ctx, w, bandY, bandH) {
  const step = Math.max(10, Math.round(Math.min(w, bandH * 6) * 0.016));
  const rows = Math.ceil(bandH / step);
  ctx.save();
  for (let row = 0; row < rows; row++) {
    const y = bandY + bandH - row * step - step / 2;
    const shrink = row / Math.max(1, rows);
    ctx.fillStyle = `rgba(255,255,255,${(0.16 * (1 - shrink)).toFixed(3)})`;
    const radius = Math.max(0.6, step * 0.22 * (1 - shrink * 0.7));
    for (let x = step / 2 + (row % 2) * step / 2; x < w; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function paintCaption(ctx, w, h, state) {
  const bandH = Math.round(h * 0.17);
  const bandY = h - bandH;
  const shade = ctx.createLinearGradient(0, bandY, 0, h);
  shade.addColorStop(0, 'rgba(12,6,22,0.82)');
  shade.addColorStop(1, 'rgba(12,6,22,0.96)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, bandY, w, bandH);
  if (state.halftone) paintHalftone(ctx, w, bandY, bandH);

  const pad = Math.round(w * 0.045);
  const title = (state.title || '').trim().toUpperCase();
  const tagline = (state.tagline || '').trim();

  ctx.save();
  ctx.translate(w / 2, bandY + bandH * 0.52);
  ctx.rotate(-0.02);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (tagline) {
    ctx.font = `${Math.round(bandH * 0.26)}px Pacifico, cursive`;
    ctx.fillStyle = taglineInk(state.titleStyle);
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = Math.round(bandH * 0.06);
    ctx.fillText(tagline, 0, -bandH * 0.26);
    ctx.shadowBlur = 0;
  }
  if (title) {
    let size = Math.round(bandH * 0.52);
    ctx.font = `${size}px Anton, sans-serif`;
    while (ctx.measureText(title).width > w * 0.92 && size > 10) {
      size -= 2;
      ctx.font = `${size}px Anton, sans-serif`;
    }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#12081f';
    ctx.lineWidth = Math.max(2, size / 13);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = Math.round(size * 0.09);
    ctx.shadowOffsetY = Math.round(size * 0.04);
    ctx.strokeText(title, 0, bandH * 0.12);
    ctx.fillStyle = captionFill(ctx, state.titleStyle, bandY, bandH);
    ctx.fillText(title, 0, bandH * 0.12);
  }
  ctx.restore();

  const heat = Math.max(1, Math.min(5, state.heat || 5));
  const stars = '★'.repeat(heat) + '☆'.repeat(5 - heat);
  ctx.font = `${Math.round(bandH * 0.2)}px Anton, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffd76a';
  ctx.fillText(`HEAT ${stars}`, w - pad, bandY + Math.round(bandH * 0.1));
}

export function paintRibbon(ctx, w, h, badge) {
  if (!badge) return;
  const bw = Math.round(w * 0.19);
  const bh = Math.max(20, Math.round(h * 0.038));
  ctx.save();
  ctx.translate(w - bw / 2 - Math.round(w * 0.02), bh);
  ctx.rotate(0.14);
  ctx.fillStyle = '#ff2e88';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = Math.round(bh * 0.25);
  ctx.shadowOffsetY = Math.round(bh * 0.1);
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.round(bh * 0.52)}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(badge).toUpperCase(), 0, 1);
  ctx.restore();
}

// --- Whole cover -----------------------------------------------------------

export function paintCover(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, '#1c1030');
  base.addColorStop(1, '#3d1030');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const rects = panelsFor(state.layout, w, h);
  const slots = state.panels || [];
  rects.forEach((rect, i) => {
    const panel = slots[i] || { photo: 0, zoom: 1, cx: 0, cy: 0 };
    const img = panel.photo >= 0 ? photos.get(panel.photo) ?? null : null;
    paintPanel(ctx, img, rect, panel, state.grade, state.layout);
  });

  paintCaption(ctx, w, h, state);
  paintRibbon(ctx, w, h, state.badge);
  if (state.vignette) paintVignette(ctx, w, h);
  if (state.grain) paintGrain(ctx, w, h);
}
