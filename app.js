/* Claude Dock site. One Capri follows you down the page; she teleports between spots with her ribbon trail
   (ported from the dock's CapriRibbons.cs). Everything else is plain DOM. */
(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const now = () => performance.now() / 1000;
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------ her clips
// n frames at fps; k = drawn height relative to her size; sx = sideways shift (fraction of her size).
const IDLE_SX = 11 / 384 * 1.11, LIE_K = 250 / 384 * 0.85;
const CLIPS = {
  idle: ['idle.png', 60, 24, 1.11, IDLE_SX], idle_blink: ['idle_blink.png', 8, 24, 1.11, IDLE_SX],
  glitch: ['glitch.webp', 10, 15, 1.11], grin: ['grin.webp', 16, 8, 1.11], dangle: ['dangle.webp', 24, 10, 1.11],
  sleep: ['sleep.webp', 16, 6, 1.11], wake: ['wake.webp', 13, 15, 1.11],
  arrive: ['arrive.png', 14, 15, 1.11], leave: ['leave.png', 12, 15, 1.11],
  perch: ['perch.png', 60, 30, 1], perch_blink: ['perch_blink.png', 8, 30, 1], perch_talk: ['perch_talk.png', 60, 30, 1],
  perch_music: ['perch_music.png', 60, 30, 1], perch_glitch: ['perch_glitch.png', 10, 15, 1],
  perch_leave: ['perch_leave.png', 12, 15, 1], perch_arrive: ['perch_arrive.png', 14, 15, 1],
  laydown: ['laydown.png', 60, 30, LIE_K], laydown_blink: ['laydown_blink.png', 8, 30, LIE_K], laydown_sleep: ['laydown_sleep.png', 60, 30, LIE_K],
  laydown_glitch: ['laydown_glitch.png', 10, 15, LIE_K], laydown_leave: ['laydown_leave.png', 12, 15, LIE_K],
};
const imgs = {};
function sheet(name) {
  if (!imgs[name]) { const im = new Image(); im.src = 'assets/capri/' + (CLIPS[name] ? CLIPS[name][0] : name); imgs[name] = im; }
  return imgs[name];
}
const ready = im => im.complete && im.naturalWidth > 0;
// Draws frame i of a clip, its height dh, its left edge at x and top at y.
function drawFrame(ctx, name, i, x, y, dh) {
  const c = CLIPS[name], im = sheet(name); if (!ready(im)) return false;
  const fw = im.naturalWidth / c[1], fh = im.naturalHeight;
  ctx.drawImage(im, i * fw, 0, fw, fh, x, y, fw / fh * dh, dh);
  return true;
}
const frameW = (name, dh) => { const c = CLIPS[name], im = sheet(name); return ready(im) ? im.naturalWidth / c[1] / im.naturalHeight * dh : dh * .6; };

// How she rests in each pose: contact = where the ledge meets her, as a fraction of her frame's height;
// cx = where along her frame the ledge's middle is.
const POSE = {
  stand: { base: 'idle', blink: 'idle_blink', glitch: 'glitch', leave: 'leave', arrive: 'arrive', talk: null, contact: .95, cx: .5, mid: .55, head: 1.08 },
  perch: { base: 'perch', blink: 'perch_blink', glitch: 'perch_glitch', leave: 'perch_leave', arrive: 'perch_arrive', talk: 'perch_talk', contact: .7, cx: .5, mid: .25, head: .74 },
  lie:   { base: 'laydown', blink: 'laydown_blink', glitch: 'laydown_glitch', leave: 'laydown_leave', arrive: null, talk: null, contact: .57, cx: .6, mid: .18, head: .5 },
};

// ------------------------------------------------------------------ her voice (the browser's, standing in for Kokoro)
let soundOn = false, voice = null;
const soundBtn = $('#soundBtn');
function pickVoice() {
  const vs = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
  voice = vs.find(v => /aria|jenny|zira|samantha|female|libby|sonia/i.test(v.name)) || vs[0] || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; } else soundBtn.hidden = true;
soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  soundBtn.setAttribute('aria-pressed', soundOn);
  soundBtn.querySelector('span').textContent = soundOn ? 'sound on' : 'sound off';
  if (soundOn) capri.say('Hi. I can talk now.'); else speechSynthesis.cancel();
});
function speak(text) {
  const est = 1000 + text.split(' ').length * 330;
  if (!soundOn || !('speechSynthesis' in window)) return wait(est);
  return new Promise(res => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.pitch = 1.45; u.rate = 1.08;
    let done = false; const fin = () => { if (!done) { done = true; res(); } };
    u.onend = fin; u.onerror = fin; setTimeout(fin, est * 2.5);
    speechSynthesis.speak(u);
  });
}

// ------------------------------------------------------------------ her ribbon trail (port of CapriRibbons.cs)
const R = { Gather: 0.24, Wait: 1.0, GiveUp: 0.18, Drawings: 9, Drawn: 1 / 24, Ball: 5, FormInCell: 0.335 };
R.Handoff = R.Ball * R.Drawn;
// hair, wide, leaves, lasts, twists, around, coil, turns, squash, tilt, offX, offY, flecks
const STRANDS = [
  [1, 1.00, 0.00, 0.52, 2.4, 0.0, 1.00, 1.5, 0.85, 0.15, 0, 0, 90],
  [0, 0.28, 0.04, 0.46, 3.1, 2.2, 0.82, 1.8, 0.60, -0.5, 0.12, -0.08, 0],
  [1, 0.78, 0.09, 0.46, 1.9, 4.1, 0.70, 1.3, 0.70, 0.6, -0.16, 0.1, 70],
  [0, 0.22, 0.13, 0.55, 2.7, 1.1, 1.14, 1.6, 0.90, -0.2, 0.05, 0.12, 0],
  [1, 0.60, 0.17, 0.43, 2.2, 3.2, 0.90, 1.2, 0.62, -0.7, 0.1, 0.05, 50],
  [0, 0.20, 0.21, 0.40, 3.4, 5.4, 0.58, 2.0, 0.75, 0.9, -0.08, -0.1, 0],
].map(a => ({ hair: !!a[0], wide: a[1], leaves: a[2], lasts: a[3], twists: a[4], around: a[5], coil: a[6], turns: a[7], squash: a[8], tilt: a[9], offX: a[10], offY: a[11], flecks: a[12] }));
const POINTS = 40;
const FORM_BOX = { l: 0, t: 124, r: 1920, b: 1720 }, FORM_MID = { x: 1015, y: 1004 };
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
function hash(seed, i) {
  let v = Math.imul((seed ^ Math.imul(i, 0x9E3779B1)) >>> 0, 0x85EBCA6B) >>> 0;
  v = (v ^ (v >>> 15)) >>> 0; v = Math.imul(v, 0xC2B2AE35) >>> 0; v = (v ^ (v >>> 13)) >>> 0;
  return v / 2147483648 - 1;
}
function wave(seed, x) { const w = Math.floor(x), p = x - w, a = hash(seed, w), b = hash(seed, w + 1); return a + (b - a) * p * p * (3 - 2 * p); }
const along = (since, lasts) => since <= 0 ? Math.max(-1, since / lasts) : since < 1 ? Math.pow(since, 1.3) : 1;

const ribbons = {
  cv: $('#ribbons'), active: false,
  fit() { const d = Math.min(devicePixelRatio || 1, 2); this.d = d; this.cv.width = innerWidth * d; this.cv.height = innerHeight * d; },
  leave(fromDoc, size) {
    this.from = fromDoc; this.body = size * 0.85; this.seed = (Math.random() * 1e9) | 0; this.travel = -1; this.t0 = now(); this.active = true;
  },
  go(toDoc, size, turned) {
    const t = now() - this.t0;
    this.to = toDoc; this.formScale = R.FormInCell * size / 384; this.turned = turned;
    this.goAt = Math.max(t, R.Gather);
    const f = this.view(this.from), o = this.view(toDoc), dist = Math.hypot(o.x - f.x, o.y - f.y);
    this.travel = Math.max(0.22, Math.min(0.42, 0.2 + dist / 5200)) * (reduced ? .6 : 1.6); // a touch slower on a page, so you can see it
    return this.goAt + this.travel - t;    // seconds until she lands
  },
  retarget(toDoc) { if (this.active) this.to = toDoc; },
  view(p) { return { x: p.x - scrollX, y: p.y - scrollY }; },
  get landing() { return this.travel < 0 ? -1 : this.goAt + this.travel; },
  get length() { return this.travel < 0 ? R.Gather + R.Wait + R.GiveUp : this.landing + Math.max(R.Drawings * R.Drawn, this.travel * 0.7); },
  wound(m, turn, i, wd, t, loop) {
    const s = STRANDS[i], size = loop * s.coil, angle = -Math.PI / 2 + turn * wd * Math.PI * 2 * s.turns;
    const far = size * (1 - 0.45 * wd) * (1 + 0.2 * wave(820 + i * 13, wd * 3 + t * 0.6));
    const x = Math.cos(angle) * far, y = Math.sin(angle) * far * s.squash, c = Math.cos(s.tilt * turn), sn = Math.sin(s.tilt * turn);
    return { x: m.x + s.offX * size * turn + x * c - y * sn, y: m.y + s.offY * size + x * sn + y * c };
  },
  shapes(t) {
    const out = [], going = this.travel >= 0;
    const from = this.view(this.from), to = going ? this.view(this.to) : null;
    const loop = this.body * 0.3, half = loop * 0.164;
    const dx = going ? to.x - from.x : 0, dy = going ? to.y - from.y : 0, distance = Math.hypot(dx, dy);
    const turn = (this.seed & 1) === 0 ? 1 : -1, exit = -turn, side = Math.abs(dx) >= 1 ? Math.sign(dx) : exit;
    const pull = Math.max(loop * 0.9, distance * 0.33), hook = exit === side ? pull : loop * 0.9, rise = Math.min(distance * 0.22, this.body * 1.1);
    STRANDS.forEach((s, i) => {
      const grown = 1 - Math.pow(1 - clamp01((t - s.leaves * R.Gather) / (R.Gather * (1 - s.leaves))), 3);
      const since = going ? (t - this.goAt) / this.travel - s.leaves : -1;
      const head = since > 0 ? since : -s.lasts * (1 - grown), tail = Math.max(-s.lasts, head - s.lasts);
      const a0 = along(tail, s.lasts), a1 = along(head, s.lasts);
      if (a1 - a0 < 0.004) return;
      const off = this.wound(from, turn, i, 0, t, loop), on = going ? { x: to.x + s.offX * loop, y: to.y + s.offY * loop } : off;
      const lt = s.tilt * turn, nt = s.tilt * side;
      const p1x = off.x + exit * Math.cos(lt) * hook, p1y = off.y + exit * Math.sin(lt) * hook;
      const p2x = on.x - side * Math.cos(nt) * pull, p2y = on.y - side * Math.sin(nt) * pull;
      const line = [], wide = [];
      for (let n = 0; n <= POINTS; n++) {
        const u = n / POINTS, p = a0 + (a1 - a0) * u;
        if (p <= 0) line.push(this.wound(from, turn, i, Math.min(1, -p), t, loop));
        else {
          const q = 1 - p;
          let x = q * q * q * off.x + 3 * q * q * p * p1x + 3 * q * p * p * p2x + p * p * p * on.x;
          let y = q * q * q * off.y + 3 * q * q * p * p1y + 3 * q * p * p * p2y + p * p * p * on.y - rise * 16 * p * p * q * q;
          const loose = smooth(p / 0.12) * (1 - smooth((p - 0.72) / 0.28)), wind = s.around + p * 7.5 - t * 2.2, apart = loop * 0.5 * loose;
          x += (Math.cos(wind) + wave(700 + i * 11, p * 3.1 + t * 0.9) * 0.6 + wave(720 + i * 7, p * 1.4 + t * 0.5) * 0.6) * apart;
          y += (Math.sin(wind) * 0.7 + wave(705 + i * 11, p * 3.1 + t * 0.9) * 0.5 + wave(725 + i * 7, p * 1.4 + t * 0.5) * 0.45) * apart;
          line.push({ x, y });
        }
        const flat = Math.abs(Math.sin(Math.PI * (u * s.twists + s.around + t * 1.1)));
        const ends = Math.pow(Math.min(1, u * 3.2), 0.8) * Math.pow(Math.min(1, (1 - u) * 6), 0.7);
        wide.push(n === 0 || n === POINTS ? 0 : half * s.wide * (0.16 + 0.84 * Math.pow(flat, 0.9)) * ends);
      }
      // outline: one edge out, the other back
      const edge = new Array(line.length * 2);
      for (let k = 0; k < line.length; k++) {
        const a = line[Math.max(0, k - 1)], b = line[Math.min(line.length - 1, k + 1)];
        let nx = a.y - b.y, ny = b.x - a.x, len = Math.hypot(nx, ny); if (len < 1e-4) { nx = ny = 0; len = 1; }
        const h = wide[k] > 0 ? Math.max(wide[k], 0.4) : 0;
        edge[k] = [line[k].x + nx / len * h, line[k].y + ny / len * h];
        edge[line.length * 2 - 1 - k] = [line[k].x - nx / len * h, line[k].y - ny / len * h];
      }
      const flecks = [];
      for (let f = 0; f < s.flecks; f++) {
        const u = 0.08 + 0.86 * (hash(900 + i, f) * 0.5 + 0.5), n = Math.min(POINTS - 1, (u * POINTS) | 0), part = u * POINTS - n;
        const girth = wide[n] + (wide[n + 1] - wide[n]) * part; if (girth < 2) continue;
        const nx = line[n].y - line[n + 1].y, ny = line[n + 1].x - line[n].x, len = Math.hypot(nx, ny); if (len < 1e-3) continue;
        const across = hash(950 + i, f) * 0.72 * girth, rad = Math.max(0.8, Math.min(3, girth * 0.14 * (0.6 + Math.abs(hash(970 + i, f)))));
        flecks.push([line[n].x + (line[n + 1].x - line[n].x) * part + nx / len * across, line[n].y + (line[n + 1].y - line[n].y) * part + ny / len * across, rad, 0.5 + 0.45 * Math.abs(hash(990 + i, f))]);
      }
      out.push({ edge, hair: s.hair, flecks });
    });
    return out;
  },
  draw() {
    const ctx = this.cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    if (!this.active) return;
    const t = now() - this.t0;
    if (t >= this.length) { this.active = false; return; }
    ctx.setTransform(this.d, 0, 0, this.d, 0, 0);
    const givenUp = this.travel < 0 ? smooth((t - R.Gather - R.Wait) / R.GiveUp) : 0, alpha = 1 - givenUp;
    if (alpha > .01) {
      ctx.globalAlpha = alpha;
      for (const sh of this.shapes(t)) {
        ctx.fillStyle = sh.hair ? '#FF0046' : '#00E86E';
        ctx.beginPath(); sh.edge.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill();
        for (const fl of sh.flecks) { ctx.fillStyle = fl[3] > .72 ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(fl[0], fl[1], fl[2], 0, 7); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    }
    // her transformation drawings, where she lands
    if (this.travel >= 0) {
      const i = Math.floor((t - this.landing) / R.Drawn), im = sheet('form.webp');
      if (i >= 0 && i < R.Drawings && ready(im)) {
        const to = this.view(this.to), s = this.formScale, cell = im.naturalWidth / R.Drawings;
        const l = (FORM_BOX.l - FORM_MID.x) * s, r = (FORM_BOX.r - FORM_MID.x) * s, top = to.y + (FORM_BOX.t - FORM_MID.y) * s, h = (FORM_BOX.b - FORM_BOX.t) * s;
        ctx.save();
        ctx.translate(to.x, 0); if (this.turned) ctx.scale(-1, 1);
        ctx.drawImage(im, i * cell, 0, cell, im.naturalHeight, l, top, r - l, h);
        ctx.restore();
      }
    }
  },
};

// ------------------------------------------------------------------ Capri herself
const spots = $$('.spot');
const capri = {
  cv: $('#capri'), pad: $('#capriPad'), bub: $('#capriBubble'),
  spot: null, pose: 'stand', flip: false, S: 200, clip: 'idle', base: 'idle', t0: now(), once: false, then: null, speed: 1,
  visible: true, phase: 'rest', pending: null, nextBlink: now() + 3, last: '', asleep: false, talking: false, drag: null,
  sizeFor(spot) { return Math.round(Math.max(120, Math.min(220, innerWidth * .16)) * (+spot.dataset.size || 1)); },
  anchor(spot) {
    const r = spot.getBoundingClientRect();
    return { x: r.left + scrollX + r.width * (+spot.dataset.ax || .5), y: r.top + scrollY };
  },
  middle(spot, pose, S) { const a = this.anchor(spot); return { x: a.x, y: a.y - POSE[pose].mid * S }; },
  baseFor(spot) {
    const pose = spot.dataset.pose;
    if (spot.dataset.sleep) return 'laydown_sleep';
    if (spot.dataset.music) return 'perch_music';
    return POSE[pose].base;
  },
  settle(spot) {
    this.spot = spot; this.pose = spot.dataset.pose; this.flip = spot.dataset.face === 'l';
    this.S = this.sizeFor(spot); this.asleep = false;
    this.base = this.baseFor(spot); this.speed = spot.dataset.music ? musicSpeed : 1;
    const d = Math.min(devicePixelRatio || 1, 2);
    this.cv.width = Math.round(this.S * d); this.cv.height = Math.round(this.S * 1.45 * d);
    this.cv.style.width = this.S + 'px'; this.cv.style.height = this.S * 1.45 + 'px';
    this.last = '';
  },
  play(name, { once = false, then = null, from = 0 } = {}) {
    if (!CLIPS[name]) return;
    sheet(name); this.clip = name; this.once = once; this.then = then; this.t0 = now() - from; this.last = '';
  },
  rest() { this.play(this.base); },
  // ---- teleporting
  goTo(spot) {
    if (!spot) return;
    if (this.phase === 'drag') return;
    if (this.phase === 'leaving' || this.phase === 'away') {   // still in the air: just stream to the newer place
      if (spot !== this.dest) { this.dest = spot; const S = this.sizeFor(spot); ribbons.retarget(this.middle(spot, spot.dataset.pose, S)); }
      return;
    }
    if (this.phase === 'landing') { this.pending = spot; return; }
    if (spot === this.spot && !this.dragged) return;
    this.dragged = false;
    this.hideBubble();
    this.dest = spot;
    const p = POSE[this.pose], fromMid = this.curMiddle();
    if (reduced) { this.settle(spot); this.play(POSE[this.pose].glitch, { once: true }); return; }
    this.phase = 'leaving';
    this.play(this.drag0 ? 'glitch' : p.leave, { once: true, then: () => {} });
    ribbons.leave(fromMid, this.S);
    setTimeout(() => {
      const dest = this.dest, S = this.sizeFor(dest), turned = dest.dataset.face !== 'l';
      const landIn = ribbons.go(this.middle(dest, dest.dataset.pose, S), S, turned);
      this.phase = 'away';
      setTimeout(() => this.land(), (landIn + R.Handoff) * 1000);
    }, 120);
  },
  land() {
    const dest = this.dest;
    this.phase = 'landing'; this.drag = null;
    this.settle(dest);
    const arrive = POSE[this.pose].arrive;
    if (arrive && !dest.dataset.sleep && !dest.dataset.music) this.play(arrive, { once: true, from: 0.7 }); else this.rest();
    setTimeout(() => {
      this.phase = 'rest';
      const p = this.pending; this.pending = null;
      if (p && p !== this.spot) this.goTo(p); else this.greet();
    }, 450);
  },
  greet() {
    const lines = GREET[this.spot.dataset.spot]; if (!lines) return;
    if (this.greeted?.[this.spot.dataset.spot]) return;
    (this.greeted ||= {})[this.spot.dataset.spot] = 1;
    this.bubble(lines, 2600);
  },
  curMiddle() {
    if (this.drag) return { x: this.drag.ax, y: this.drag.ay - .55 * this.S };
    return this.middle(this.spot, this.pose, this.S);
  },
  // ---- reactions
  glitch() { this.play(this.drag ? 'glitch' : POSE[this.pose].glitch, { once: true }); },
  async say(text, { talk = true } = {}) {
    if (this.phase !== 'rest') return;
    this.bubble(text, 0);
    const t = POSE[this.pose].talk;
    if (talk && t && !this.spot.dataset.music) { this.talking = true; this.play(t); }
    await speak(text);
    this.talking = false;
    if (this.clip === t) this.rest();
    this.hideBubble(600);
  },
  bubble(text, ms) {
    this.bub.textContent = text; this.bub.classList.add('show'); this.placeBubble();
    clearTimeout(this.bubT); if (ms) this.bubT = setTimeout(() => this.bub.classList.remove('show'), ms);
  },
  hideBubble(after = 0) { clearTimeout(this.bubT); this.bubT = setTimeout(() => this.bub.classList.remove('show'), after); },
  placeBubble() {
    if (!this.spot) return;
    const a = this.drag ? { x: this.drag.ax, y: this.drag.ay } : this.anchor(this.spot);
    // beside her head, on the side she faces (or wherever there's room)
    const head = a.y - POSE[this.drag ? 'stand' : this.pose].head * this.S;
    const w = this.bub.offsetWidth, gap = this.S * .28;
    let x = this.flip ? a.x - gap - w : a.x + gap;
    if (x + w > scrollX + innerWidth - 44) x = a.x - gap - w;
    if (x < scrollX + 10) x = a.x + gap;
    this.bub.style.transform = `translate(${x}px, ${head}px)`;
  },
  // ---- drawing, every frame
  frame() {
    if (!this.spot) return;
    const hidden = this.phase === 'away' || (this.phase === 'leaving' && now() - this.t0 > 0.32);
    this.cv.style.opacity = hidden ? 0 : 1;
    this.pad.style.display = hidden ? 'none' : 'block';
    const pose = this.drag ? 'stand' : this.pose, S = this.S;
    const a = this.drag ? { x: this.drag.ax, y: this.drag.ay } : this.anchor(this.spot);
    const left = a.x - S / 2, top = a.y - 1.12 * S;
    this.cv.style.transform = `translate(${left}px, ${top}px)`;
    // grab pad over her body
    const box = { stand: [.42, 1.05, 0], perch: [.5, .7, .22], lie: [.8, .42, .12] }[pose];
    this.pad.style.width = box[0] * S + 'px'; this.pad.style.height = (box[1] + box[2]) * S + 'px';
    this.pad.style.transform = `translate(${a.x - box[0] * S / 2}px, ${a.y - box[1] * S}px)`;
    if (this.bub.classList.contains('show')) this.placeBubble();
    // which frame
    const t = now();
    const pz = POSE[pose];
    if (this.phase === 'rest' && !this.once && this.clip === this.base && this.base === pz.base && t > this.nextBlink) {
      this.nextBlink = t + 2.5 + Math.random() * 4; this.play(pz.blink, { once: true });
    }
    let c = CLIPS[this.clip], i = Math.floor((t - this.t0) * c[2] * (this.clip === 'perch_music' ? this.speed : 1));
    if (this.once && i >= c[1]) {
      if (this.phase === 'leaving') i = c[1] - 1;
      else { const th = this.then; this.rest(); if (typeof th === 'function') th(); c = CLIPS[this.clip]; i = 0; }
    }
    i = ((i % c[1]) + c[1]) % c[1];
    const key = this.clip + i + S + this.flip;
    if (key === this.last) return;
    const ctx = this.cv.getContext('2d'), d = this.cv.width / S, dh = S * c[3] * d;
    const contact = this.drag ? 1 : pz.contact;
    const dw = frameW(this.clip, dh);
    const x = this.cv.width / 2 - (this.drag ? .5 : pz.cx) * dw + (c[4] || 0) * S * d;
    const y = 1.12 * S * d - contact * dh;
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    ctx.save();
    if (this.flip) { ctx.translate(this.cv.width, 0); ctx.scale(-1, 1); }
    if (drawFrame(ctx, this.clip, i, x, y, dh)) this.last = key;
    ctx.restore();
  },
};
const GREET = {
  talk: 'Hold the button. I\'m listening.',
  listen: 'Pick a moment. I\'ll say it.',
  dock: 'Drag the dock around. I\'ll wait up here.',
  street: 'This is my street.',
  built: 'zzz…',
};
const POKE = {
  hero: ["Hi, I'm Capri. I live in Claude Dock.", 'Scroll down. I\'ll follow you.', 'Stop poking me.', 'Claude is still thinking. Probably.'],
  talk: ['Ctrl, Alt, Space, and just talk.', 'I type it in for you.'],
  listen: ['Claude needs your OK.', 'Done.'],
  dock: ['Comfy up here.', 'It slides away when you leave it.'],
  street: ['Nice beat.', 'Try the sliders.'],
  built: ['Five more minutes…', 'zzz… Claude Code… zzz'],
};
const pokeI = {};

// dragging and poking her
const pad = capri.pad;
pad.addEventListener('pointerdown', e => {
  if (capri.phase !== 'rest') return;
  try { pad.setPointerCapture(e.pointerId); } catch (_) {}
  capri.press = { x: e.clientX, y: e.clientY, moved: false };
});
pad.addEventListener('pointermove', e => {
  const p = capri.press; if (!p) return;
  if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) {
    p.moved = true; pad.classList.add('dragging');
    capri.drag = { ax: 0, ay: 0 }; capri.phase = 'drag'; capri.hideBubble();
    capri.play('dangle'); capri.bubble('Wheee—', 1400);
  }
  if (p.moved) { capri.drag.ax = e.clientX + scrollX; capri.drag.ay = e.clientY + scrollY + capri.S * .95; }
});
function release() {
  const p = capri.press; capri.press = null; if (!p) return;
  pad.classList.remove('dragging');
  if (p.moved) {
    capri.phase = 'rest'; capri.dragged = true; capri.drag0 = true;
    // let go: she glitches out where you dropped her and ribbons back to where she belongs
    const mid = capri.curMiddle();
    capri.phase = 'leaving'; capri.dest = currentSpot() || capri.spot;
    capri.play('glitch', { once: true });
    ribbons.leave(mid, capri.S);
    capri.drag0 = false; capri.dragged = false;
    setTimeout(() => {
      const dest = capri.dest, S = capri.sizeFor(dest);
      const landIn = ribbons.go(capri.middle(dest, dest.dataset.pose, S), S, dest.dataset.face !== 'l');
      capri.phase = 'away';
      setTimeout(() => capri.land(), (landIn + R.Handoff) * 1000);
    }, 120);
    return;
  }
  poke();
}
pad.addEventListener('pointerup', release);
pad.addEventListener('pointercancel', release);
pad.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke(); } });
let lastPoke = 0;
function poke() {
  wakeUp();
  const key = capri.spot.dataset.spot, t = now();
  if (t - lastPoke < 0.3 && capri.pose === 'stand') { capri.play('grin', { once: true }); capri.bubble('Heh.', 1500); lastPoke = 0; return; }
  lastPoke = t;
  capri.glitch();
  if (key === 'hero') { const ti = $('.title'); ti.classList.remove('glitching'); void ti.offsetWidth; ti.classList.add('glitching'); }
  const lines = POKE[key] || POKE.hero; pokeI[key] = (pokeI[key] || 0) + 1;
  const line = lines[pokeI[key] % lines.length];
  capri.bubble(line, 2800); speak(line);
}

// she naps if nobody does anything for a while
let lastActive = now();
function wakeUp() {
  lastActive = now();
  if (!capri.asleep) return;
  capri.asleep = false;
  capri.base = capri.baseFor(capri.spot);
  if (capri.pose === 'stand') capri.play('wake', { once: true }); else capri.rest();
}
['pointermove', 'keydown', 'scroll', 'touchstart'].forEach(ev => addEventListener(ev, () => { if (capri.asleep) wakeUp(); else lastActive = now(); }, { passive: true }));
setInterval(() => {
  if (capri.asleep || capri.phase !== 'rest' || capri.talking || now() - lastActive < 22) return;
  if (capri.pose === 'stand') { capri.asleep = true; capri.base = 'sleep'; capri.rest(); capri.bubble('zzz', 2000); }
  else if (capri.pose === 'lie' && capri.base !== 'laydown_sleep') { capri.asleep = true; capri.base = 'laydown_sleep'; capri.rest(); }
}, 1000);

// ------------------------------------------------------------------ which section you're in
const sections = $$('.sec');
const railLinks = $$('#rail a');
let activeSec = null;
function currentSection() {
  const mid = innerHeight * 0.5;
  return sections.find(s => { const r = s.getBoundingClientRect(); return r.top <= mid && r.bottom > mid; }) || sections[0];
}
const spotOf = sec => $(`.spot[data-spot="${sec.id}"]`);
const currentSpot = () => spotOf(currentSection());
function track() {
  const sec = currentSection();
  if (sec === activeSec) return;
  activeSec = sec;
  railLinks.forEach(a => a.classList.toggle('on', a.dataset.for === sec.id));
  const sign = $('.neon', sec); if (sign) { sign.classList.remove('flickering'); void sign.offsetWidth; sign.classList.add('flickering'); }
  if (capri.spot) capri.goTo(spotOf(sec));
}

// parallax: scene layers drift slower than the page
const layers = $$('.scene [data-depth]').map(el => ({ el, depth: +el.dataset.depth, sec: el.closest('.sec') }));
function parallax() {
  if (reduced) return;
  for (const l of layers) {
    const r = l.sec.getBoundingClientRect();
    if (r.bottom < -200 || r.top > innerHeight + 200) continue;
    l.el.style.transform = `translateY(${(-r.top * l.depth).toFixed(1)}px)`;
  }
}

// ------------------------------------------------------------------ the loop
function loop() {
  track(); parallax(); capri.frame(); ribbons.draw(); minis.forEach(m => m.draw());
  requestAnimationFrame(loop);
}
function start() {
  ribbons.fit();
  capri.settle(currentSpot());
  capri.rest();
  activeSec = currentSection();
  railLinks.forEach(a => a.classList.toggle('on', a.dataset.for === activeSec.id));
  if (activeSec.id === 'hero') setTimeout(() => capri.bubble("Hi, I'm Capri. Poke me.", 4000), 900);
  requestAnimationFrame(loop);
  // get her other looks ready
  setTimeout(() => ['perch', 'perch_blink', 'perch_leave', 'perch_arrive', 'leave', 'arrive', 'glitch', 'perch_glitch', 'laydown', 'laydown_blink', 'laydown_leave', 'laydown_sleep', 'perch_music', 'perch_talk', 'dangle', 'form.webp'].forEach(sheet), 600);
}
addEventListener('resize', () => { ribbons.fit(); if (capri.spot && capri.phase === 'rest') capri.settle(capri.spot); place(); });
sheet('idle'); sheet('idle_blink');

// ------------------------------------------------------------------ small Capris (helper clones in the shop window)
const minis = [];
class Mini {
  constructor(cv) { this.cv = cv; this.clip = 'idle'; this.t0 = now(); this.once = false; this.then = null; minis.push(this); }
  play(name, once = false, then = null) { sheet(name); this.clip = name; this.once = once; this.then = then; this.t0 = now(); }
  draw() {
    const c = CLIPS[this.clip]; let i = Math.floor((now() - this.t0) * c[2]);
    if (this.once && i >= c[1]) { const th = this.then; this.play('idle'); if (th) th(); return; }
    i %= c[1];
    const r = this.cv.getBoundingClientRect(); if (!r.width) return;
    const d = Math.min(devicePixelRatio || 1, 2);
    if (this.cv.width !== Math.round(r.width * d)) { this.cv.width = Math.round(r.width * d); this.cv.height = Math.round(r.height * d); }
    const ctx = this.cv.getContext('2d'), H = this.cv.height, dh = H, dw = frameW(this.clip, dh);
    ctx.clearRect(0, 0, this.cv.width, H);
    drawFrame(ctx, this.clip, i, (this.cv.width - dw) / 2 + (c[4] || 0) * H / 1.11, 0, dh);
  }
  remove() { minis.splice(minis.indexOf(this), 1); this.cv.remove(); }
}

// ------------------------------------------------------------------ 01 talk
const micBtn = $('#micBtn'), micLabel = $('#micLabel'), waveEl = $('#wave'), cap = $('#voiceCaption');
const termLog = $('#termLog'), termInput = $('#termInput'), termTitle = $('#termTitle');
for (let i = 0; i < 30; i++) waveEl.appendChild(document.createElement('i'));
const bars = $$('i', waveEl);
const RUNS = [
  { said: 'Add a dark mode toggle to the settings page',
    steps: [['tool', '● Read(src/pages/Settings.tsx)'], ['tool', '● Update(src/pages/Settings.tsx)  +24 −3'], ['tool', '● Bash(npm test)'], ['ok', '  ⎿ 42 passed']],
    reply: 'Added a dark mode toggle to the settings page and saved the choice. All 42 tests pass.' },
  { said: 'Why is the login test failing',
    steps: [['tool', '● Bash(npm test -- login)'], ['dim', '  ⎿ 1 failed: expected 200, got 401'], ['tool', '● Update(tests/login.test.ts)  +3 −2']],
    reply: 'The login test set the token too late. I moved it into beforeEach and it passes now.' },
  { said: 'Summarise what changed on this branch',
    steps: [['tool', '● Bash(git log main..HEAD --oneline)'], ['dim', '  ⎿ 3 files changed, 118 insertions(+)']],
    reply: 'This branch adds CSV export to the reports page and fixes the date filter.' },
];
let runI = 0, listening = false, busy = false, t0 = 0, waveT = null;
const firstSentence = s => (s.match(/^(.+?[.!?])(\s|$)/) || [, s])[1];
function startListen() {
  if (listening || busy) return;
  listening = true; t0 = performance.now();
  micBtn.classList.add('live'); waveEl.classList.add('live'); micLabel.textContent = 'Listening…'; cap.textContent = 'Listening…';
  waveT = setInterval(() => bars.forEach((b, i) => { b.style.height = (6 + Math.random() * 48 * Math.sin(i / bars.length * Math.PI)) + 'px'; }), 80);
}
async function stopListen() {
  if (!listening) return;
  listening = false; clearInterval(waveT);
  micBtn.classList.remove('live'); waveEl.classList.remove('live'); bars.forEach(b => b.style.height = '6px'); micLabel.textContent = 'Hold to talk';
  if (performance.now() - t0 < 450) { cap.textContent = 'Hold it a little longer, then let go.'; return; }
  busy = true; micBtn.disabled = true;
  const run = RUNS[runI++ % RUNS.length];
  cap.textContent = 'Turning speech into text…'; await wait(650);
  cap.textContent = `“${run.said}”`;
  termLog.innerHTML = '';
  for (const ch of run.said) { termInput.textContent += ch; await wait(24 + Math.random() * 28); }
  await wait(300);
  addLine('> ' + run.said, 't-acc'); termInput.textContent = '';
  const spin = '✶✸✹✺✹✷'; let s = 0;
  const spinT = setInterval(() => termTitle.textContent = spin[s++ % spin.length] + ' ' + run.said, 140);
  for (const [cls, text] of run.steps) { await wait(600); addLine(text, { tool: 't-tool', ok: 't-ok', dim: 't-dim' }[cls]); }
  await wait(650);
  addLine('● ' + run.reply, '', true);
  clearInterval(spinT); termTitle.textContent = 'Claude Code';
  const line = firstSentence(run.reply);
  cap.innerHTML = '<span class="who">Capri:</span> ' + esc(line);
  if (capri.spot?.dataset.spot === 'talk') await capri.say(line); else await speak(line);
  busy = false; micBtn.disabled = false;
}
function addLine(text, cls, gap) { const p = document.createElement('p'); p.textContent = text; p.className = cls || ''; if (gap) p.style.marginTop = '8px'; termLog.appendChild(p); }
micBtn.addEventListener('pointerdown', e => { e.preventDefault(); try { micBtn.setPointerCapture(e.pointerId); } catch (_) {} startListen(); });
['pointerup', 'pointercancel'].forEach(ev => micBtn.addEventListener(ev, stopListen));
micBtn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startListen(); } });
micBtn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') stopListen(); });
addEventListener('keydown', e => { if (e.ctrlKey && e.altKey && e.code === 'Space' && !e.repeat) { e.preventDefault(); startListen(); } });
addEventListener('keyup', e => { if (listening && (e.code === 'Space' || e.key === 'Control' || e.key === 'Alt')) stopListen(); });

// ------------------------------------------------------------------ 02 listen: the dock's own Speech.Done, ported
function doneLine(message) {
  if (!message || !message.trim()) return 'Done.';
  let t = message
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/`([^`]{1,40})`/g, '$1')
    .replace(/`[^`]*`/g, ' ')
    .replace(/[A-Za-z]:\\[^\s:*?"<>|]+/g, m => m.replace(/[\\.,]+$/, '').split('\\').pop())
    .replace(/^\s*(#+|>|[-*+]|\d+\.|\|)\s*/gm, '')
    .split('**').join('').split('__').join('').split('|').join(' ')
    .replace(/\s+/g, ' ').trim();
  if (!t) return 'Done.';
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  let first = m ? m[1] : t;
  const words = first.split(' ');
  if (words.length > 28) first = words.slice(0, 28).join(' ') + '.';
  return first;
}
const mdIn = $('#mdIn'), mdOut = $('#mdOut');
mdIn.value = 'Fixed the crash in `parser.ts`: it choked on `C:\\Users\\me\\data\\report.csv` because the path ended in a slash, see [the docs](https://example.com/docs). Also tidied the imports.\n\n```js\nconst clean = path.replace(/\\\\$/, "");\n```\n\n- Added a regression test\n- **All 42 tests pass**';
let ev = 'done';
const EV = { done: () => doneLine(mdIn.value), perm: () => 'Claude needs your OK to use Bash.', ask: () => 'Claude has a question for you.', error: () => 'Claude hit an error.', toolfail: () => null };
function fire(name, out = true) {
  ev = name;
  $$('.events button').forEach(b => b.classList.toggle('on', b.dataset.ev === name));
  const text = EV[name]();
  const here = capri.spot?.dataset.spot === 'listen';
  if (!text) { mdOut.innerHTML = '<span class="t-dim">(no words, just a quick glitch)</span>'; if (out && here) capri.glitch(); return; }
  mdOut.textContent = text;
  if (out) { if (here) capri.say(text); else speak(text); }
}
$$('.events button').forEach(b => b.addEventListener('click', () => fire(b.dataset.ev)));
mdIn.addEventListener('input', () => { if (ev === 'done') mdOut.textContent = doneLine(mdIn.value); });
fire('done', false);

// ------------------------------------------------------------------ 03 dock
const CHATS = [
  ['Portfolio site for Claude Dock', 'now', '~/projects/claude-dock-site'], ['Fix login test in CI', '2h', '~/projects/my-app'],
  ['Hackathon application answers', '5h', '~/notes'], ['Refactor voice thread', 'yesterday', '~/projects/claude-dock'],
  ['Make Capri sit on the taskbar', 'yesterday', '~/projects/claude-dock'], ['CSV export for reports page', 'Mon', '~/projects/my-app'],
  ['Beat detection from audio meters', 'Sat', '~/projects/claude-dock'], ['Explain sherpa-onnx config', 'Fri', '~/projects/claude-dock'],
];
const list = $('#dockList');
function renderChats(q = '') {
  q = q.toLowerCase();
  list.innerHTML = CHATS.filter(c => c[0].toLowerCase().includes(q)).map(c =>
    `<li data-toast="claude --resume · ${esc(c[0])}"><div class="t"><span>${esc(c[0])}</span><em>${c[1]}</em></div><div class="f">${c[2]}</div></li>`).join('') || '<li class="f">No chats match.</li>';
}
renderChats();
$('#dockSearch').addEventListener('input', e => renderChats(e.target.value));
const screen = $('#screen'), dock = $('#dockPanel'), head = $('#dockHead'), glow = $('#edgeGlow'), toast = $('#toast'), autoHide = $('#autoHide');
let side = 'left', hideT = null, hidden = false, dragD = null;
function showToast(t) { toast.textContent = t; toast.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => toast.classList.remove('show'), 1900); }
screen.addEventListener('click', e => {
  const t = e.target.closest('[data-toast]'); if (!t) return;
  showToast(t.dataset.toast);
  if (t.classList.contains('d-voice')) { t.classList.add('live'); setTimeout(() => t.classList.remove('live'), 1600); }
});
function place() {
  const sw = screen.clientWidth, dw = dock.offsetWidth;
  dock.style.left = (side === 'left' ? 12 : sw - dw - 12) + 'px';
  glow.className = 'edge-glow ' + side + (hidden ? ' on' : '');
}
function slide(away) { hidden = away; const dw = dock.offsetWidth + 30; dock.style.transform = away ? `translateX(${side === 'left' ? -dw : dw}px)` : ''; place(); }
head.addEventListener('pointerdown', e => { try { head.setPointerCapture(e.pointerId); } catch (_) {} dock.classList.add('dragging'); dragD = { x: e.clientX, left: dock.offsetLeft }; });
head.addEventListener('pointermove', e => { if (!dragD) return; dock.style.left = Math.max(0, Math.min(screen.clientWidth - dock.offsetWidth, dragD.left + e.clientX - dragD.x)) + 'px'; });
head.addEventListener('pointerup', () => { if (!dragD) return; dragD = null; dock.classList.remove('dragging'); side = dock.offsetLeft + dock.offsetWidth / 2 < screen.clientWidth / 2 ? 'left' : 'right'; place(); });
dock.addEventListener('pointerenter', () => clearTimeout(hideT));
dock.addEventListener('pointerleave', () => { if (!autoHide.checked || dragD || document.activeElement === $('#dockSearch')) return; clearTimeout(hideT); hideT = setTimeout(() => slide(true), 700); });
glow.addEventListener('pointerenter', () => slide(false));
glow.addEventListener('click', () => slide(false));
autoHide.addEventListener('change', () => { if (!autoHide.checked) slide(false); });
place();
new IntersectionObserver((es, o) => es.forEach(e => {
  if (e.isIntersecting) { o.disconnect(); setTimeout(() => { if (!dock.matches(':hover') && autoHide.checked) { slide(true); showToast('Touch the glowing strip to bring it back'); } }, 2400); }
}), { threshold: .7 }).observe(screen);
function setAcc(c) { dock.style.setProperty('--acc', c); glow.style.background = c; glow.style.boxShadow = `0 0 14px 3px ${c}`; }
setAcc('#D97757');
$$('.look .seg').forEach(seg => seg.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('button', seg).forEach(x => x.classList.toggle('on', x === b)); dock.dataset[seg.dataset.set] = b.dataset.v;
}));
$('#swatches').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#swatches button').forEach(x => x.classList.toggle('on', x === b)); setAcc(getComputedStyle(b).getPropertyValue('--c').trim());
});

// ------------------------------------------------------------------ 04 street
// clones
const cloneStage = $('#cloneStage'), cloneBtn = $('#cloneBtn');
cloneStage.innerHTML = '<span class="empty">no subagents running</span>';
['arrive', 'leave'].forEach(sheet);
cloneBtn.addEventListener('click', async () => {
  cloneBtn.disabled = true; cloneStage.innerHTML = '';
  const made = [];
  for (let i = 0; i < 3; i++) {
    const cv = document.createElement('canvas'); cloneStage.appendChild(cv);
    const m = new Mini(cv); m.play('arrive', true); made.push(m);
    await wait(600);
  }
  cloneBtn.textContent = 'Working…';
  await wait(2400);
  for (const m of made) { m.play('leave', true, () => m.remove()); await wait(450); }
  await wait(900);
  cloneStage.innerHTML = '<span class="empty">no subagents running</span>';
  cloneBtn.textContent = 'Run 3 subagents'; cloneBtn.disabled = false;
});
// beat: she sways to it on the awning
let musicSpeed = 112 / 112;
const bpm = $('#bpm'), bpmOut = $('#bpmOut'), beats = $$('#beat i');
let beatN = 0, beatT = null;
function setBpm() {
  const v = +bpm.value; bpmOut.textContent = v + ' BPM'; musicSpeed = v / 112;
  if (capri.spot?.dataset.music) capri.speed = musicSpeed;
  clearInterval(beatT); beatT = setInterval(() => { beats.forEach((b, i) => b.classList.toggle('on', i === beatN % 4)); beatN++; }, 60000 / v);
}
bpm.addEventListener('input', setBpm); setBpm();
// style
$('#hue').addEventListener('input', e => document.documentElement.style.setProperty('--capri-hue', e.target.value + 'deg'));

start();
})();
