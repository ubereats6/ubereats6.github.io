let referencePromise;
function references() {
  if (!referencePromise) referencePromise = fetch('features.json').then(response => {
    if (!response.ok) throw new Error('地圖比對資料載入失敗');
    return response.json();
  }).then(items => items.map(item => {
    const bytes = atob(item.mask);
    const pixels = new Uint8Array(item.w * item.h);
    for (let i = 0; i < pixels.length; i++) pixels[i] = (bytes.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
    return { id: item.id, w: item.w, h: item.h, pixels };
  }));
  return referencePromise;
}
function resizeMask(source, width, height) {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = Math.min(source.w - 1, Math.floor((x + .5) * source.w / width));
    const sy = Math.min(source.h - 1, Math.floor((y + .5) * source.h / height));
    out[y * width + x] = source.pixels[sy * source.w + sx];
  }
  return out;
}
function samples(mask, w, h) {
  let total = 0;
  for (const bit of mask) total += bit;
  const stride = Math.max(1, Math.ceil(Math.sqrt(total / 260)));
  const positive = [], empty = [];
  for (let y = 0; y < h; y += stride) for (let x = 0; x < w; x += stride) {
    const point = [x, y];
    if (mask[y * w + x]) positive.push(point);
    else empty.push(point);
  }
  if (empty.length > 170) {
    const keep = Math.ceil(empty.length / 170);
    return [positive, empty.filter((_, i) => i % keep === 0)];
  }
  return [positive, empty];
}
function scoreAt(ref, pos, empty, x, y) {
  const bits = ref.pixels, w = ref.w;
  let hits = 0, falseFloor = 0;
  for (const [px, py] of pos) hits += bits[(y + py) * w + x + px];
  for (const [px, py] of empty) falseFloor += bits[(y + py) * w + x + px];
  return hits / pos.length - .28 * falseFloor / Math.max(1, empty.length);
}
function matchOne(ref, query) {
  let best = -1;
  const scaleSizes = [...new Set([30, 38, 47, 57, 68, 79, 91, 104, 116, Math.max(query.w, query.h)])];
  for (const size of scaleSizes) {
    const w = Math.max(1, Math.round(query.w * size / Math.max(query.w, query.h)));
    const h = Math.max(1, Math.round(query.h * size / Math.max(query.w, query.h)));
    if (w > ref.w || h > ref.h) continue;
    const mask = resizeMask(query, w, h);
    const [pos, empty] = samples(mask, w, h);
    if (pos.length < 12) continue;
    let localBest = -1, bestX = 0, bestY = 0;
    const maxX = ref.w - w, maxY = ref.h - h;
    for (let y = 0; y <= maxY; y += 2) for (let x = 0; x <= maxX; x += 2) {
      const score = scoreAt(ref, pos, empty, x, y);
      if (score > localBest) { localBest = score; bestX = x; bestY = y; }
    }
    for (let y = Math.max(0, bestY - 2); y <= Math.min(maxY, bestY + 2); y++)
      for (let x = Math.max(0, bestX - 2); x <= Math.min(maxX, bestX + 2); x++)
        localBest = Math.max(localBest, scoreAt(ref, pos, empty, x, y));
    best = Math.max(best, localBest + .08 * size / 116);
  }
  return best;
}
self.onmessage = async ({data}) => {
  if (data.type !== 'match') return;
  try {
    const refs = await references();
    const query = {w:data.w,h:data.h,pixels:new Uint8Array(data.pixels)};
    const results = refs.map(ref => ({id:ref.id,score:matchOne(ref,query)}))
      .sort((a,b) => b.score - a.score).slice(0,4);
    self.postMessage({type:'result',results});
  } catch (error) { self.postMessage({type:'error',message:error.message||'比對失敗'}); }
};
