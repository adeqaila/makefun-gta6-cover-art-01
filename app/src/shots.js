// Fixed scenes for screenshots: ?shot=cover shows the cover alone at the
// page's size, ?shot=editor shows the app with a photo loaded. Query params
// pick the layout, grade, size, title, tagline and photos. window.__shotReady
// is set once the scene has painted.

const SHOT_SRC = {
  pier: 'samples/pier.jpg',
  boulevard: 'samples/boulevard.jpg',
  neon: 'samples/neon.jpg',
  sunset: 'samples/sunset.jpg',
};
const SHOT_LABELS = { pier: 'Pier', boulevard: 'Boulevard', neon: 'Neon', sunset: 'Sunset' };

function numberList(text, fallback) {
  if (!text) return fallback;
  return text.split(',').map((n) => Number(n));
}

// Applies the scene from `params` through the callbacks main.js provides,
// then marks the page ready for a screenshot.
export async function playShot(shot, params, api) {
  const layout = params.get('layout') || 'hero3';
  const grade = params.get('grade') || 'sunset';
  const size = params.get('size') || '1080x1080';
  const title = params.get('title') || 'Sunset Heist';
  const tagline = params.get('tagline') || 'Vice Lights';
  const titleStyle = params.get('titleStyle') || 'sunset';
  const badge = params.get('badge') || 'HOT';
  const heat = Number(params.get('heat') || 5);
  const picks = [
    params.get('photo') || 'pier',
    params.get('photo2') || 'boulevard',
    params.get('photo3') || 'neon',
    params.get('photo4') || 'sunset',
  ];
  const panelPhotos = numberList(params.get('panels'), [0, 1, 2, 3, 0, 1, 2, 3, 0]);
  const zooms = numberList(params.get('zoom'), [1, 1, 1.2, 1.2, 1.3, 1.3, 1.4, 1.4, 1.5]);
  // Default pan favours the top of a photo (faces) for the portrait samples.
  const pans = numberList(
    params.get('cy'),
    panelPhotos.map((p) => (p === 0 ? 0 : 0.35)),
  );
  const pansX = numberList(params.get('cx'), panelPhotos.map(() => 0));

  const photos = picks.map((name) => ({
    label: SHOT_LABELS[name] || name,
    src: SHOT_SRC[name] || SHOT_SRC.pier,
  }));
  await api.setPhotos(photos);
  api.setState({
    layout,
    grade,
    size,
    title,
    tagline,
    titleStyle,
    badge,
    heat,
    panels: panelPhotos.map((photo, i) => ({
      photo,
      zoom: zooms[i] || 1,
      cx: pansX[i] || 0,
      cy: pans[i] || 0,
    })),
  });

  if (shot === 'cover') {
    document.body.classList.add('cover-only');
    // The cover fills the viewport at the page's own size, so the screenshot
    // is the app's own drawing of the exported cover at a size within the
    // gate's limits.
    const canvas = document.getElementById('cover');
    const [w, h] = size.split('x').map(Number);
    const scale = Math.min(window.innerWidth / w, window.innerHeight / h);
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
  }
  api.syncAll();
  api.paint();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
