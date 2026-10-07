'use strict';
/*
 * art.js — deterministic risograph-style landscape plates, emitted as inline SVG.
 *
 * Every plate is pure vector: flat colour bands, one luminous disc, a few hairlines.
 * No external assets, no filters (grain and halftone are applied once in CSS over
 * the .plate wrapper, so 60 plates on a page stay cheap to paint).
 */

/* ---------------------------------------------------------------- randomness */

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = hash(seed);
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (v) => Math.round(v * 100) / 100;

/* ------------------------------------------------------------------ palettes */
/* Each palette is a five-stop ramp read far → near, plus a luminous disc.      */

const PALETTES = {
  ember:  { sky: '#F7E7D6', haze: '#EFC9A4', far: '#D89263', mid: '#B25C33', near: '#7A2F1C', deep: '#3B1410', disc: '#E8552A' },
  indigo: { sky: '#E7E8EE', haze: '#BCC2D6', far: '#8189A9', mid: '#4E5578', near: '#282E4C', deep: '#12152A', disc: '#F0D49B' },
  jade:   { sky: '#EDF0E6', haze: '#C8D5BE', far: '#94AE8E', mid: '#5B7C60', near: '#2F4C3C', deep: '#152A22', disc: '#F2C15B' },
  sand:   { sky: '#F6EFE1', haze: '#E7D4B4', far: '#CFAF7F', mid: '#A9814D', near: '#71512C', deep: '#3A2716', disc: '#E9A13B' },
  rose:   { sky: '#F8EBE7', haze: '#EBC9C2', far: '#D39C95', mid: '#A96A66', near: '#743F41', deep: '#3B1E23', disc: '#E97A63' },
  slate:  { sky: '#EFEEEA', haze: '#CFCEC7', far: '#A3A29A', mid: '#71716A', near: '#434340', deep: '#1E1E1C', disc: '#C9A15A' },
  cobalt: { sky: '#E6EEF2', haze: '#B4D0DC', far: '#74A5BC', mid: '#3E7391', near: '#1F4560', deep: '#0E2233', disc: '#F4CE7E' },
  moss:   { sky: '#F1EFE2', haze: '#D5D3B4', far: '#AEAE81', mid: '#7E8256', near: '#4C5334', deep: '#242A19', disc: '#E4B14A' },
  plum:   { sky: '#F2EAF0', haze: '#D6C3D5', far: '#AC90B0', mid: '#7A5C84', near: '#4B3455', deep: '#241628', disc: '#E9A05F' },
  ice:    { sky: '#F1F5F7', haze: '#D5E2E8', far: '#AAC3CE', mid: '#7A97A6', near: '#4A6373', deep: '#22323E', disc: '#F6E2C0' },
};

const PALETTE_KEYS = Object.keys(PALETTES);

/* ------------------------------------------------------------------ geometry */

/** Closed polygon that fills from a top polyline down to the bottom edge. */
function fill(points, W, H) {
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${n(p[0])} ${n(p[1])}`).join('');
  return `${d}L${W} ${H}L0 ${H}Z`;
}

/** Smooth (Catmull-Rom → bezier) top polyline closed to the bottom edge. */
function smoothFill(points, W, H) {
  if (points.length < 3) return fill(points, W, H);
  let d = `M${n(points[0][0])} ${n(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${n(c1[0])} ${n(c1[1])},${n(c2[0])} ${n(c2[1])},${n(p2[0])} ${n(p2[1])}`;
  }
  return `${d}L${W} ${H}L0 ${H}Z`;
}

/** Jagged ridge line: fractal midpoint displacement across the full width. */
function ridge(r, W, base, amp, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const wobble = Math.sin(t * Math.PI * (1 + r() * 2)) * amp * 0.35;
    pts.push([t * W, base - amp * r() - wobble]);
  }
  pts[0][0] = -4;
  pts[pts.length - 1][0] = W + 4;
  return pts;
}

/** Rolling wave line for dunes, water and aurora. */
function wave(W, base, amp, freq, phase) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    pts.push([t * W, base - Math.sin(t * Math.PI * freq + phase) * amp]);
  }
  pts[0][0] = -4;
  pts[24][0] = W + 4;
  return pts;
}

const path = (d, f, extra = '') => `<path d="${d}" fill="${f}"${extra}/>`;

/** The sun/moon disc — the recurring "view" motif across every plate. */
function disc(cx, cy, rr, p, id, ring) {
  let s = `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(rr)}" fill="${p.disc}"/>`;
  if (ring) {
    s += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(rr + 14)}" fill="none" stroke="${p.disc}" stroke-width="1" opacity=".45"/>`;
  }
  return s;
}

/* -------------------------------------------------------------------- scenes */

const SCENES = {
  /* Layered summits receding into haze. */
  peaks(r, W, H, p) {
    const hz = H * 0.62;
    let s = path(`M0 0H${W}V${hz}H0Z`, p.sky);
    s += path(`M0 ${n(hz * 0.42)}H${W}V${n(hz)}H0Z`, p.haze, ' opacity=".85"');
    s += disc(W * (0.24 + r() * 0.5), hz * 0.4, W * 0.085, p, 0, true);
    const layers = [
      { base: hz + 6, amp: H * 0.30, c: p.far, st: 7 },
      { base: hz + H * 0.10, amp: H * 0.26, c: p.mid, st: 9 },
      { base: hz + H * 0.22, amp: H * 0.22, c: p.near, st: 11 },
      { base: hz + H * 0.34, amp: H * 0.16, c: p.deep, st: 13 },
    ];
    layers.forEach((l) => { s += path(fill(ridge(r, W, l.base, l.amp, l.st), W, H), l.c); });
    return s;
  },

  /* Sand seas — long smooth crests, one low sun. */
  dunes(r, W, H, p) {
    const hz = H * 0.44;
    let s = path(`M0 0H${W}V${hz}H0Z`, p.sky);
    s += path(`M0 ${n(hz * 0.55)}H${W}V${n(hz)}H0Z`, p.haze, ' opacity=".8"');
    s += disc(W * 0.7, hz * 0.52, W * 0.1, p, 0, false);
    const cs = [p.far, p.mid, p.near, p.deep];
    cs.forEach((c, i) => {
      const base = hz + (H - hz) * (0.06 + i * 0.24);
      s += path(smoothFill(wave(W, base, H * (0.07 - i * 0.008), 1.1 + i * 0.6, r() * 6), W, H), c);
    });
    return s;
  },

  /* Flat sea, a bar of sun, hairline swell. */
  sea(r, W, H, p) {
    const hz = H * 0.52;
    let s = path(`M0 0H${W}V${hz}H0Z`, p.sky);
    s += path(`M0 ${n(hz * 0.28)}H${W}V${n(hz)}H0Z`, p.haze, ' opacity=".7"');
    const cx = W * 0.5;
    s += disc(cx, hz * 0.5, W * 0.11, p, 0, true);
    s += path(`M0 ${n(hz)}H${W}V${H}H0Z`, p.mid);
    s += path(smoothFill(wave(W, hz + (H - hz) * 0.34, H * 0.02, 2.2, r() * 6), W, H), p.near);
    s += path(smoothFill(wave(W, hz + (H - hz) * 0.7, H * 0.018, 1.6, r() * 6), W, H), p.deep);
    for (let i = 0; i < 7; i++) {
      const y = hz + (H - hz) * (0.04 + i * 0.04);
      const w = W * (0.30 - i * 0.03);
      s += `<rect x="${n(cx - w / 2)}" y="${n(y)}" width="${n(w)}" height="2" fill="${p.disc}" opacity="${n(0.5 - i * 0.05)}"/>`;
    }
    return s;
  },

  /* Stepped rice terraces cut by a valley. */
  terraces(r, W, H, p) {
    const hz = H * 0.34;
    let s = path(`M0 0H${W}V${hz}H0Z`, p.sky);
    s += disc(W * 0.78, hz * 0.42, W * 0.075, p, 0, false);
    s += path(fill(ridge(r, W, hz + 10, H * 0.12, 8), W, H), p.far);
    const steps = 9;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const base = hz + (H - hz) * (0.12 + t * 0.95);
      const c = i % 2 ? p.mid : p.near;
      s += path(smoothFill(wave(W, base, H * 0.035, 0.9 + i * 0.12, i * 1.4 + r()), W, H), c);
      s += `<path d="${smoothFill(wave(W, base - 3, H * 0.035, 0.9 + i * 0.12, i * 1.4 + r()), W, H)}" fill="${p.haze}" opacity=".28"/>`;
    }
    s += path(smoothFill(wave(W, H * 0.97, H * 0.02, 1.2, 2), W, H), p.deep);
    return s;
  },

  /* Conifer rows in retreating tone. */
  forest(r, W, H, p) {
    const hz = H * 0.46;
    let s = path(`M0 0H${W}V${hz}H0Z`, p.sky);
    s += path(`M0 ${n(hz * 0.4)}H${W}V${n(hz)}H0Z`, p.haze, ' opacity=".75"');
    s += disc(W * 0.3, hz * 0.44, W * 0.07, p, 0, true);
    s += path(fill(ridge(r, W, hz + 8, H * 0.14, 7), W, H), p.far, ' opacity=".55"');
    const rows = [
      { y: hz + H * 0.10, h: H * 0.16, c: p.far, count: 26 },
      { y: hz + H * 0.22, h: H * 0.22, c: p.mid, count: 19 },
      { y: hz + H * 0.36, h: H * 0.30, c: p.near, count: 13 },
      { y: hz + H * 0.52, h: H * 0.40, c: p.deep, count: 9 },
    ];
    rows.forEach((row) => {
      let d = '';
      for (let i = 0; i <= row.count; i++) {
        const x = (i / row.count) * (W + 40) - 20 + (r() - 0.5) * 10;
        const h = row.h * (0.7 + r() * 0.6);
        const w = h * 0.34;
        d += `M${n(x - w)} ${n(row.y)}L${n(x)} ${n(row.y - h)}L${n(x + w)} ${n(row.y)}Z`;
      }
      s += path(d, row.c);
      s += path(`M0 ${n(row.y - 1)}H${W}V${H}H0Z`, row.c);
    });
    return s;
  },

  /* Pack ice and a sun that never quite sets. */
  arctic(r, W, H, p) {
    const hz = H * 0.55;
    let s = path(`M0 0H${W}V${hz}H0Z`, p.sky);
    s += path(`M0 ${n(hz * 0.3)}H${W}V${n(hz)}H0Z`, p.haze, ' opacity=".6"');
    s += disc(W * 0.62, hz * 0.72, W * 0.09, p, 0, true);
    s += path(`M0 ${n(hz)}H${W}V${H}H0Z`, p.far);
    let bergs = '';
    let shadow = '';
    for (let i = 0; i < 6; i++) {
      const cx = W * (0.06 + i * 0.17 + r() * 0.05);
      const base = hz + (H - hz) * (0.12 + r() * 0.35);
      const w = W * (0.09 + r() * 0.1);
      const h = H * (0.08 + r() * 0.14);
      bergs += `M${n(cx - w)} ${n(base)}L${n(cx - w * 0.35)} ${n(base - h)}L${n(cx + w * 0.2)} ${n(base - h * 0.62)}L${n(cx + w)} ${n(base)}Z`;
      shadow += `M${n(cx - w)} ${n(base)}L${n(cx - w * 0.35)} ${n(base - h)}L${n(cx - w * 0.1)} ${n(base - h * 0.2)}Z`;
    }
    s += path(bergs, p.mid);
    s += path(shadow, p.near, ' opacity=".6"');
    s += path(smoothFill(wave(W, H * 0.82, H * 0.015, 1.4, 1.1), W, H), p.near);
    s += path(smoothFill(wave(W, H * 0.94, H * 0.012, 2.0, 3.3), W, H), p.deep);
    return s;
  },

  /* Mesa blocks and a canyon floor. */
  canyon(r, W, H, p) {
    const hz = H * 0.4;
    let s = path(`M0 0H${W}V${hz}H0Z`, p.sky);
    s += path(`M0 ${n(hz * 0.35)}H${W}V${n(hz)}H0Z`, p.haze, ' opacity=".7"');
    s += disc(W * 0.2, hz * 0.4, W * 0.07, p, 0, false);
    const cs = [p.far, p.mid, p.near, p.deep];
    cs.forEach((c, li) => {
      let d = '';
      let x = -20;
      const base = hz + (H - hz) * (0.08 + li * 0.2);
      while (x < W + 20) {
        const w = W * (0.08 + r() * 0.16);
        const h = H * (0.06 + r() * (0.16 - li * 0.02));
        d += `M${n(x)} ${n(base)}L${n(x)} ${n(base - h)}L${n(x + w)} ${n(base - h)}L${n(x + w)} ${n(base)}Z`;
        x += w;
      }
      s += path(d + `M0 ${n(base - 1)}H${W}V${H}H0Z`, c);
    });
    return s;
  },

  /* An archipelago and its reflection. */
  isles(r, W, H, p) {
    const hz = H * 0.56;
    let s = path(`M0 0H${W}V${hz}H0Z`, p.sky);
    s += path(`M0 ${n(hz * 0.34)}H${W}V${n(hz)}H0Z`, p.haze, ' opacity=".7"');
    s += disc(W * 0.74, hz * 0.4, W * 0.08, p, 0, true);
    const isle = (cx, w, h, c) => {
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        pts.push([cx - w + t * w * 2, hz - Math.sin(t * Math.PI) * h * (0.75 + Math.sin(t * 7) * 0.25)]);
      }
      let d = `M${n(pts[0][0])} ${n(hz)}`;
      pts.forEach((q) => { d += `L${n(q[0])} ${n(q[1])}`; });
      return path(d + `L${n(cx + w)} ${n(hz)}Z`, c);
    };
    s += isle(W * 0.24, W * 0.2, H * 0.14, p.far);
    s += isle(W * 0.62, W * 0.26, H * 0.2, p.mid);
    s += isle(W * 0.9, W * 0.16, H * 0.1, p.far);
    s += path(`M0 ${n(hz)}H${W}V${H}H0Z`, p.near);
    for (let i = 0; i < 9; i++) {
      const y = hz + (H - hz) * (0.06 + i * 0.1);
      s += `<rect x="${n(W * (0.05 + r() * 0.2))}" y="${n(y)}" width="${n(W * (0.2 + r() * 0.55))}" height="2" fill="${p.haze}" opacity=".3"/>`;
    }
    s += path(smoothFill(wave(W, H * 0.93, H * 0.016, 1.8, 0.7), W, H), p.deep);
    return s;
  },

  /* A skyline read as flat architecture — for the art & architecture strand. */
  city(r, W, H, p) {
    const hz = H * 0.74;
    let s = path(`M0 0H${W}V${hz}H0Z`, p.sky);
    s += path(`M0 ${n(hz * 0.3)}H${W}V${n(hz)}H0Z`, p.haze, ' opacity=".6"');
    s += disc(W * 0.28, hz * 0.28, W * 0.08, p, 0, true);
    const cs = [p.far, p.mid, p.near];
    cs.forEach((c, li) => {
      let d = '';
      let x = -20;
      const base = hz - (2 - li) * H * 0.02 + li * H * 0.04;
      while (x < W + 20) {
        const w = W * (0.04 + r() * 0.09);
        const h = H * (0.08 + r() * (0.34 - li * 0.08));
        d += `M${n(x)} ${n(base)}L${n(x)} ${n(base - h)}L${n(x + w)} ${n(base - h)}L${n(x + w)} ${n(base)}Z`;
        if (li === 2 && r() > 0.55) {
          const dome = w * 0.5;
          d += `M${n(x)} ${n(base - h)}A${n(dome)} ${n(dome)} 0 0 1 ${n(x + w)} ${n(base - h)}Z`;
        }
        x += w + W * 0.008;
      }
      s += path(d, c);
    });
    s += path(`M0 ${n(hz + H * 0.08)}H${W}V${H}H0Z`, p.deep);
    /* Windows: the only ornament. */
    let win = '';
    for (let i = 0; i < 40; i++) {
      win += `<rect x="${n(r() * W)}" y="${n(hz - r() * H * 0.3)}" width="3" height="6" fill="${p.disc}" opacity="${n(0.25 + r() * 0.5)}"/>`;
    }
    return s + win;
  },

  /* Aurora bands over a dark horizon. */
  aurora(r, W, H, p) {
    let s = path(`M0 0H${W}V${H}H0Z`, p.deep);
    for (let i = 0; i < 5; i++) {
      const base = H * (0.18 + i * 0.09);
      const pts = wave(W, base, H * (0.06 + r() * 0.05), 1.2 + i * 0.5, i * 1.9 + r() * 3);
      let d = `M${n(pts[0][0])} ${n(pts[0][1])}`;
      pts.forEach((q) => { d += `L${n(q[0])} ${n(q[1])}`; });
      for (let j = pts.length - 1; j >= 0; j--) d += `L${n(pts[j][0])} ${n(pts[j][1] + H * 0.1)}`;
      s += path(d + 'Z', i % 2 ? p.far : p.mid, ` opacity="${n(0.32 + i * 0.09)}"`);
    }
    let stars = '';
    for (let i = 0; i < 46; i++) {
      stars += `<circle cx="${n(r() * W)}" cy="${n(r() * H * 0.62)}" r="${n(0.6 + r() * 1.1)}" fill="${p.sky}" opacity="${n(0.25 + r() * 0.6)}"/>`;
    }
    s += stars;
    s += path(fill(ridge(r, W, H * 0.84, H * 0.14, 9), W, H), p.near);
    s += path(fill(ridge(r, W, H * 0.94, H * 0.1, 11), W, H), '#0B0C14');
    return s;
  },
};

const SCENE_KEYS = Object.keys(SCENES);

/* -------------------------------------------------------------------- public */

/**
 * plate(seed, opts) → inline <svg> string.
 *   seed   deterministic key (usually a slug) so a place always looks the same
 *   scene  one of SCENE_KEYS; picked from the seed when omitted
 *   tone   one of PALETTE_KEYS; picked from the seed when omitted
 *   ratio  'portrait' | 'landscape' | 'square' | 'panorama'
 */
function plate(seed, opts = {}) {
  const r = rng(seed);
  const scene = opts.scene && SCENES[opts.scene] ? opts.scene : SCENE_KEYS[Math.floor(rng(seed + '·s')() * SCENE_KEYS.length)];
  const tone = opts.tone && PALETTES[opts.tone] ? opts.tone : PALETTE_KEYS[Math.floor(rng(seed + '·t')() * PALETTE_KEYS.length)];
  const box = { portrait: [800, 1040], landscape: [1280, 800], square: [1000, 1000], panorama: [1600, 700] }[opts.ratio || 'portrait'];
  const [W, H] = box;
  const body = SCENES[scene](r, W, H, PALETTES[tone]);
  return (
    `<svg class="plate__svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" ` +
    `role="img" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${body}</svg>`
  );
}

module.exports = { plate, PALETTE_KEYS, SCENE_KEYS, PALETTES };
