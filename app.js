/* Claude Dock site. Capri's sprite strips are drawn on canvases; everything else is plain DOM. */
(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = ms => new Promise(r => setTimeout(r, ms));

// ------------------------------------------------------------------ Capri's clips
// n frames at fps; k = drawn height relative to her size (as in the dock); sx = sideways shift as a fraction of her size.
const IDLE_SX = 11 / 384 * 1.11;
const CLIPS = {
  idle:         { f: 'idle.png',          n: 60, fps: 24, k: 1.11, sx: IDLE_SX },
  idle_blink:   { f: 'idle_blink.png',    n: 8,  fps: 24, k: 1.11, sx: IDLE_SX },
  walk:         { f: 'walk.png',          n: 12, fps: 12, k: 1.11 },
  glitch:       { f: 'glitch.webp',       n: 10, fps: 15, k: 1.11 },
  grin:         { f: 'grin.webp',         n: 16, fps: 8,  k: 1.11 },
  dangle:       { f: 'dangle.webp',       n: 24, fps: 10, k: 1.11 },
  sleep:        { f: 'sleep.webp',        n: 16, fps: 6,  k: 1.11 },
  wake:         { f: 'wake.webp',         n: 13, fps: 15, k: 1.11 },
  arrive:       { f: 'arrive.png',        n: 14, fps: 15, k: 1.11 },
  leave:        { f: 'leave.png',         n: 12, fps: 15, k: 1.11 },
  perch:        { f: 'perch.png',         n: 60, fps: 30, k: 1 },
  perch_blink:  { f: 'perch_blink.png',   n: 8,  fps: 30, k: 1 },
  perch_talk:   { f: 'perch_talk.png',    n: 60, fps: 30, k: 1 },
  perch_music:  { f: 'perch_music.png',   n: 60, fps: 30, k: 1 },
  perch_glitch: { f: 'perch_glitch.png',  n: 10, fps: 15, k: 1 },
};
const imgs = {};
function sheet(name) {
  if (!imgs[name]) { const im = new Image(); im.src = 'assets/capri/' + CLIPS[name].f; imgs[name] = im; }
  return imgs[name];
}

const all = [];
class Capri {
  constructor(canvas, { base = 'idle', blink = null } = {}) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.base = base; this.blinkClip = blink; this.flip = false; this.speed = 1;
    this.unit = CLIPS[base].k; this.visible = false; this.blinkFor = base;
    this.nextBlink = performance.now() + 2000 + Math.random() * 3000;
    sheet(base); if (blink) sheet(blink);
    this.play(base);
    all.push(this); io.observe(canvas); ro.observe(canvas);
  }
  play(name, { once = false, then = null } = {}) {
    sheet(name);
    this.cur = name; this.t0 = performance.now(); this.once = once; this.then = then; this.last = -1;
  }
  setBase(name) { this.base = name; this.play(name); }
  get looping() { return !this.once && this.cur === this.base; }
  fit() {
    const r = this.c.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    this.c.width = Math.round(r.width * d); this.c.height = Math.round(r.height * d); this.last = -1;
  }
  draw(now) {
    if (this.blinkClip && this.looping && this.cur === this.blinkFor && now > this.nextBlink) {
      this.nextBlink = now + 2500 + Math.random() * 4000;
      this.play(this.blinkClip, { once: true });
    }
    const clip = CLIPS[this.cur], im = sheet(this.cur);
    let i = Math.floor((now - this.t0) / 1000 * clip.fps * this.speed);
    if (this.once && i >= clip.n) {
      const then = this.then;
      if (typeof then === 'function') { this.play(this.base); then(this); }
      else this.play(then || this.base);
      return this.draw(now);
    }
    i %= clip.n;
    if (i === this.last || !im.complete || !im.naturalWidth) return;
    this.last = i;
    const W = this.c.width, H = this.c.height, ctx = this.ctx;
    const fw = im.naturalWidth / clip.n, fh = im.naturalHeight;
    const size = H / this.unit;                       // her size in canvas pixels
    const dh = size * clip.k, dw = fw / fh * dh;
    const x = (W - dw) / 2 + (clip.sx || 0) * size;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (this.flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im, i * fw, 0, fw, fh, x, H - dh, dw, dh);
    ctx.restore();
  }
}
const io = new IntersectionObserver(es => es.forEach(e => {
  const c = all.find(a => a.c === e.target); if (c) { c.visible = e.isIntersecting; c.last = -1; }
}), { rootMargin: '100px' });
const ro = new ResizeObserver(es => es.forEach(e => { const c = all.find(a => a.c === e.target); if (c) c.fit(); }));
(function loop(now) { for (const c of all) if (c.visible) c.draw(now); requestAnimationFrame(loop); })(performance.now());

// ------------------------------------------------------------------ her voice (the browser's, standing in for Kokoro)
let soundOn = false, voice = null;
const soundBtn = $('#soundBtn');
function pickVoice() {
  const vs = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
  voice = vs.find(v => /aria|jenny|zira|samantha|female|libby|sonia/i.test(v.name)) || vs[0] || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
else soundBtn.hidden = true;
soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  soundBtn.setAttribute('aria-pressed', soundOn);
  soundBtn.querySelector('span').textContent = soundOn ? 'sound on' : 'sound off';
  if (soundOn) say('Hi. I can talk now.'); else speechSynthesis.cancel();
});
// Speaks if sound is on; resolves when done (or after a reading-time estimate when muted).
function say(text) {
  const est = 900 + text.split(' ').length * 330;
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
function bubble(el, text, ms) {
  el.textContent = text; el.classList.add('show');
  clearTimeout(el._t); if (ms) el._t = setTimeout(() => el.classList.remove('show'), ms);
}

// ------------------------------------------------------------------ hero
const heroC = $('#heroCapri'), heroB = $('#heroBubble');
const hero = new Capri(heroC, { base: 'idle', blink: 'idle_blink' });
['glitch', 'grin', 'dangle', 'sleep', 'wake'].forEach(sheet); // warm up
setTimeout(() => bubble(heroB, "Hi, I'm Capri. Poke me.", 5000), 900);

const LINES = [
  "Hi, I'm Capri. I live in Claude Dock.",
  'Scroll down. I\'ll show you around.',
  'Ctrl, Alt, Space, and just talk.',
  'Claude needs your OK.',
  'Done.',
  'Claude is still thinking. Probably.',
  'Stop poking me.',
];
let lineI = 0, asleep = false, lastActive = performance.now();
function heroGlitch() {
  document.body.classList.add('glitching');
  setTimeout(() => document.body.classList.remove('glitching'), 420);
}
let drag = null, clickT = null;
heroC.addEventListener('pointerdown', e => {
  heroC.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, moved: false };
});
heroC.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) > 6) {
    drag.moved = true; heroC.classList.add('dragging');
    heroC.style.transition = 'none'; hero.play('dangle');
    hero.base = 'dangle'; bubble(heroB, 'Wheee—', 1500);
  }
  if (drag.moved) heroC.style.transform = `translate(${dx}px, ${dy}px)`;
});
heroC.addEventListener('pointerup', () => {
  if (!drag) return;
  const moved = drag.moved; drag = null;
  if (moved) {
    heroC.classList.remove('dragging');
    heroC.style.transition = 'transform .55s cubic-bezier(.5,0,.6,1.4)';
    heroC.style.transform = '';
    setTimeout(() => { hero.base = 'idle'; hero.play('glitch', { once: true }); heroGlitch(); }, 450);
    return;
  }
  // a click; two quick clicks make her grin
  if (clickT) { clearTimeout(clickT); clickT = null; hero.play('grin', { once: true }); bubble(heroB, 'Heh.', 1800); return; }
  clickT = setTimeout(() => {
    clickT = null; wakeHero();
    hero.play('glitch', { once: true }); heroGlitch();
    const l = LINES[lineI++ % LINES.length]; bubble(heroB, l, 3200); say(l);
  }, 230);
});
function wakeHero() {
  lastActive = performance.now();
  if (asleep) { asleep = false; hero.base = 'idle'; hero.play('wake', { once: true }); bubble(heroB, "Oh! I'm up.", 2000); }
}
['pointermove', 'keydown', 'scroll'].forEach(ev => addEventListener(ev, () => { if (asleep) wakeHero(); else lastActive = performance.now(); }, { passive: true }));
setInterval(() => {
  if (!asleep && hero.visible && !drag && performance.now() - lastActive > 18000 && hero.looping) {
    asleep = true; hero.setBase('sleep'); bubble(heroB, 'zzz', 2500);
  }
}, 1000);

// ------------------------------------------------------------------ 01 voice
const voiceCapri = new Capri($('#voiceCapri'), { base: 'perch', blink: 'perch_blink' });
sheet('perch_talk');
const micBtn = $('#micBtn'), micLabel = $('#micLabel'), wave = $('#wave'), cap = $('#voiceCaption');
const termLog = $('#termLog'), termInput = $('#termInput'), termTitle = $('#termTitle');
for (let i = 0; i < 32; i++) wave.appendChild(document.createElement('i'));
const bars = $$('i', wave);

const RUNS = [
  { said: 'Add a dark mode toggle to the settings page',
    steps: [['tool', '● Read(src/pages/Settings.tsx)'], ['tool', '● Update(src/pages/Settings.tsx)  +24 −3'], ['tool', '● Bash(npm test)'], ['ok', '  ⎿ 42 passed']],
    reply: 'Added a dark mode toggle to the settings page and saved the choice in local storage. All 42 tests pass.' },
  { said: 'Why is the login test failing',
    steps: [['tool', '● Bash(npm test -- login)'], ['dim', '  ⎿ 1 failed: expected 200, got 401'], ['tool', '● Read(tests/login.test.ts)'], ['tool', '● Update(tests/login.test.ts)  +3 −2']],
    reply: 'The login test failed because the mock server answered before the token was set. I moved the token setup into beforeEach and it passes now.' },
  { said: 'Summarise what changed on this branch',
    steps: [['tool', '● Bash(git log main..HEAD --oneline)'], ['tool', '● Bash(git diff --stat main)'], ['dim', '  ⎿ 3 files changed, 118 insertions(+), 12 deletions(-)']],
    reply: 'This branch adds CSV export to the reports page and fixes the date filter. Three files changed and every test passes.' },
];
let runI = 0, listening = false, busy = false, t0 = 0, waveT = null;
const firstSentence = s => (s.match(/^(.+?[.!?])(\s|$)/) || [, s])[1];

function startListen() {
  if (listening || busy) return;
  listening = true; t0 = performance.now();
  micBtn.classList.add('live'); wave.classList.add('live'); micLabel.textContent = 'Listening…';
  cap.textContent = 'Listening…';
  waveT = setInterval(() => bars.forEach((b, i) => {
    const env = Math.sin((i / bars.length) * Math.PI);
    b.style.height = (6 + Math.random() * 46 * env) + 'px';
  }), 80);
}
async function stopListen() {
  if (!listening) return;
  listening = false; clearInterval(waveT);
  micBtn.classList.remove('live'); wave.classList.remove('live');
  bars.forEach(b => b.style.height = '6px');
  micLabel.textContent = 'Hold to talk';
  if (performance.now() - t0 < 450) { cap.textContent = 'Hold it a little longer, then let go.'; return; }
  busy = true; micBtn.disabled = true;
  const run = RUNS[runI++ % RUNS.length];
  cap.textContent = 'Turning speech into text, on the CPU…';
  await wait(700);
  cap.textContent = `“${run.said}”`;
  termLog.innerHTML = '';
  for (const ch of run.said) { termInput.textContent += ch; await wait(26 + Math.random() * 30); }
  await wait(350);
  line(termLog, '> ' + run.said, 'in'); termInput.textContent = '';
  const spin = '✶✸✹✺✹✷'; let s = 0;
  const spinT = setInterval(() => termTitle.textContent = spin[s++ % spin.length] + ' ' + run.said, 140);
  for (const [cls, text] of run.steps) { await wait(650); line(termLog, text, cls); }
  await wait(700);
  line(termLog, '● ' + run.reply, 'reply');
  clearInterval(spinT); termTitle.textContent = 'Claude Code';
  const spoken = firstSentence(run.reply);
  cap.innerHTML = '<span class="t-acc">Capri:</span> ' + esc(spoken);
  voiceCapri.play('perch_talk');
  await say(spoken);
  voiceCapri.play('perch');
  busy = false; micBtn.disabled = false;
}
function line(el, text, cls) {
  const p = document.createElement('p'); p.textContent = text;
  p.className = { tool: 't-tool', ok: 't-ok', dim: 't-dim', in: 't-acc', reply: '' }[cls] || '';
  if (cls === 'reply') p.style.marginTop = '8px';
  el.appendChild(p);
}
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
micBtn.addEventListener('pointerdown', e => { e.preventDefault(); try { micBtn.setPointerCapture(e.pointerId); } catch (_) {} startListen(); });
['pointerup', 'pointercancel'].forEach(ev => micBtn.addEventListener(ev, stopListen));
micBtn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startListen(); } });
micBtn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') stopListen(); });
addEventListener('keydown', e => {
  if (e.ctrlKey && e.altKey && e.code === 'Space' && !e.repeat) { e.preventDefault(); startListen(); }
});
addEventListener('keyup', e => { if (listening && (e.code === 'Space' || e.key === 'Control' || e.key === 'Alt')) stopListen(); });

// ------------------------------------------------------------------ 02 reads: the dock's own Speech.Done, ported
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
const permLine = msg => { const m = msg.trim().replace('your permission', 'your OK'); return m.endsWith('.') ? m : m + '.'; };

const mdIn = $('#mdIn'), mdOut = $('#mdOut'), readB = $('#readBubble');
mdIn.value = 'Fixed the crash in `parser.ts`: it choked on `C:\\Users\\me\\data\\report.csv` because the path ended in a slash, see [the docs](https://example.com/docs). Also tidied the imports.\n\n```js\nconst clean = path.replace(/\\\\$/, "");\n```\n\n- Added a regression test\n- **All 42 tests pass**';
const readCapri = new Capri($('#readCapri'), { base: 'perch', blink: 'perch_blink' });
sheet('perch_glitch');
let ev = 'done';
const EV = {
  done: () => doneLine(mdIn.value),
  perm: () => permLine('Claude needs your permission to use Bash'),
  ask: () => 'Claude has a question for you.',
  error: () => 'Claude hit an error.',
  toolfail: () => null,
  compact: () => null,
};
async function fire(name, speak = true) {
  ev = name;
  $$('.events button').forEach(b => b.classList.toggle('on', b.dataset.ev === name));
  const text = EV[name]();
  if (!text) {
    mdOut.innerHTML = `<span class="t-dim">(no words: a quick glitch${name === 'compact' ? ' while Claude compacts its memory' : ' when a tool fails'})</span>`;
    readB.classList.remove('show');
    readCapri.play('perch_glitch', { once: true });
    return;
  }
  mdOut.textContent = text;
  if (!speak) return;
  bubble(readB, text, 0);
  readCapri.play('perch_talk');
  await say(text);
  if (ev === name) { readCapri.play('perch'); readB.classList.remove('show'); }
}
$$('.events button').forEach(b => b.addEventListener('click', () => fire(b.dataset.ev)));
mdIn.addEventListener('input', () => { if (ev === 'done') mdOut.textContent = doneLine(mdIn.value); });
fire('done', false);
// she says it once when the section comes into view
new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { o.disconnect(); setTimeout(() => fire('done'), 600); } }), { threshold: .6 }).observe($('.reads-demo'));

// ------------------------------------------------------------------ 03 dock
const CHATS = [
  ['Portfolio site for Claude Dock', 'now', '~/projects/claude-dock-site'],
  ['Fix login test in CI', '2h', '~/projects/my-app'],
  ['Hackathon application answers', '5h', '~/notes'],
  ['Refactor voice thread', 'yesterday', '~/projects/claude-dock'],
  ['Make Capri sit on the taskbar', 'yesterday', '~/projects/claude-dock'],
  ['CSV export for reports page', 'Mon', '~/projects/my-app'],
  ['Read Blackboard announcements', 'Sun', '~/uni'],
  ['Beat detection from audio meters', 'Sat', '~/projects/claude-dock'],
  ['Explain sherpa-onnx config structs', 'Fri', '~/projects/claude-dock'],
];
const list = $('#dockList');
function renderChats(q = '') {
  q = q.toLowerCase();
  list.innerHTML = CHATS.filter(c => c[0].toLowerCase().includes(q)).map(c =>
    `<li data-toast="claude --resume · ${esc(c[0])}"><div class="t"><span>${esc(c[0])}</span><em>${c[1]}</em></div><div class="f">${c[2]}</div></li>`
  ).join('') || '<li class="f">No chats match.</li>';
}
renderChats();
$('#dockSearch').addEventListener('input', e => renderChats(e.target.value));

const screen = $('#screen'), dock = $('#dockPanel'), head = $('#dockHead'), glow = $('#edgeGlow'), toast = $('#toast');
let side = 'left', hideT = null, hidden = false, dragD = null;
const autoHide = $('#autoHide');
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
function slide(away) {
  hidden = away;
  const dw = dock.offsetWidth + 30;
  dock.style.transform = away ? `translateX(${side === 'left' ? -dw : dw}px)` : '';
  place();
}
head.addEventListener('pointerdown', e => {
  head.setPointerCapture(e.pointerId); dock.classList.add('dragging');
  dragD = { x: e.clientX, left: dock.offsetLeft };
});
head.addEventListener('pointermove', e => {
  if (!dragD) return;
  const max = screen.clientWidth - dock.offsetWidth;
  dock.style.left = Math.max(0, Math.min(max, dragD.left + e.clientX - dragD.x)) + 'px';
});
head.addEventListener('pointerup', () => {
  if (!dragD) return; dragD = null; dock.classList.remove('dragging');
  side = dock.offsetLeft + dock.offsetWidth / 2 < screen.clientWidth / 2 ? 'left' : 'right';
  place();
});
dock.addEventListener('pointerenter', () => clearTimeout(hideT));
dock.addEventListener('pointerleave', () => {
  if (!autoHide.checked || dragD || document.activeElement === $('#dockSearch')) return;
  clearTimeout(hideT); hideT = setTimeout(() => slide(true), 700);
});
glow.addEventListener('pointerenter', () => slide(false));
glow.addEventListener('click', () => slide(false));
autoHide.addEventListener('change', () => { if (!autoHide.checked) slide(false); });
addEventListener('resize', place);
place();
// show the slide-away once when the dock comes into view
new IntersectionObserver((es, o) => es.forEach(e => {
  if (e.isIntersecting) { o.disconnect(); setTimeout(() => { if (!dock.matches(':hover') && autoHide.checked) { slide(true); showToast('Touch the glowing strip to bring it back'); } }, 2200); }
}), { threshold: .7 }).observe(screen);

function setAcc(c) { dock.style.setProperty('--acc', c); glow.style.background = c; glow.style.boxShadow = `0 0 14px 3px ${c}`; }
setAcc('#D97757');
$$('.look .seg').forEach(seg => seg.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('button', seg).forEach(x => x.classList.toggle('on', x === b));
  dock.dataset[seg.dataset.set] = b.dataset.v;
}));
$('#swatches').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#swatches button').forEach(x => x.classList.toggle('on', x === b));
  setAcc(getComputedStyle(b).getPropertyValue('--c').trim());
});

// a tiny Capri walking along the taskbar
const walkerC = $('#walkCapri');
const walker = new Capri(walkerC, { base: 'idle', blink: 'idle_blink' });
sheet('walk');
let wx = 80, wdir = 1, pauseUntil = 0, lastW = performance.now();
(function walk(now) {
  const dt = Math.min(0.05, (now - lastW) / 1000); lastW = now;
  if (walker.visible) {
    const max = screen.clientWidth - walkerC.offsetWidth;
    if (now < pauseUntil) { if (walker.cur === 'walk') walker.setBase('idle'); }
    else {
      if (walker.base !== 'walk') walker.setBase('walk');
      wx += wdir * 38 * dt;
      if (wx < 0 || wx > max) { wx = Math.max(0, Math.min(max, wx)); wdir *= -1; }
      if (Math.random() < dt / 6) pauseUntil = now + 1500 + Math.random() * 2500;
    }
    walker.flip = wdir < 0;
    walkerC.style.transform = `translateX(${wx}px)`;
  }
  requestAnimationFrame(walk);
})(lastW);

// ------------------------------------------------------------------ 04 cards
// helper clones
const cloneStage = $('#cloneStage'), cloneBtn = $('#cloneBtn');
new Capri($('#cloneMain'), { base: 'idle', blink: 'idle_blink' });
sheet('arrive'); sheet('leave');
cloneBtn.addEventListener('click', async () => {
  cloneBtn.disabled = true;
  const made = [];
  for (let i = 0; i < 3; i++) {
    const cv = document.createElement('canvas'); cv.className = 'capri clone'; cloneStage.appendChild(cv);
    const c = new Capri(cv, { base: 'idle', blink: 'idle_blink' }); c.nextBlink += i * 700;
    c.play('arrive', { once: true }); made.push([cv, c]);
    await wait(650);
  }
  cloneBtn.textContent = 'Subagents working…';
  await wait(2600);
  for (const [cv, c] of made) {
    c.play('leave', { once: true, then: () => { cv.remove(); all.splice(all.indexOf(c), 1); } });
    await wait(500);
  }
  await wait(900);
  cloneBtn.textContent = 'Start 3 subagents'; cloneBtn.disabled = false;
});

// music
const music = new Capri($('#musicCapri'), { base: 'perch_music' });
const bpm = $('#bpm'), bpmOut = $('#bpmOut'), beats = $$('#beat i');
let beatN = 0, beatT = null;
function setBpm() {
  const v = +bpm.value; bpmOut.textContent = v + ' BPM'; music.speed = v / 112;
  clearInterval(beatT);
  beatT = setInterval(() => { beats.forEach((b, i) => b.classList.toggle('on', i === beatN % 4)); beatN++; }, 60000 / v);
}
bpm.addEventListener('input', setBpm); setBpm();

// style
const hue = $('#hue'), hueOut = $('#hueOut');
new Capri($('#styleCapri'), { base: 'idle', blink: 'idle_blink' });
hue.addEventListener('input', () => {
  document.documentElement.style.setProperty('--capri-hue', hue.value + 'deg');
  hueOut.textContent = hue.value + '°';
});

// desktop life: she glitches when you hover, and now and then on her own
const gC = $('#glitchCapri');
const g = new Capri(gC, { base: 'idle', blink: 'idle_blink' });
gC.parentElement.addEventListener('pointerenter', () => { if (g.looping) g.play('glitch', { once: true }); });
setInterval(() => { if (g.visible && g.looping) g.play(Math.random() < .5 ? 'glitch' : 'grin', { once: true }); }, 7000);
})();
