/* The city around the page: two buildings framing it from the rooftops down to the street, wires between them,
   and a far skyline that stays behind everything. One continuous world, so no section ends in a hard cut. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const svgURI = s => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

// ---------------------------------------------------------------- building fronts: windows, ledges, the odd AC unit
function facade(w, h, lit, s0) {
  seed = s0;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
  for (let y = 0; y < h; y += 60) s += `<rect x="0" y="${y + 56}" width="${w}" height="4" fill="#24123f" opacity=".45"/>`;
  for (let y = 10; y < h - 10; y += 20) {
    for (let x = 8; x < w - 12; x += 16) {
      const q = rnd();
      const c = q < .2 ? lit[0] : q < .3 ? lit[1] : q < .34 ? lit[2] : '#24123f';
      s += `<rect x="${x}" y="${y}" width="8" height="11" fill="${c}" opacity="${c === '#24123f' ? .35 : .95}"/>`;
    }
  }
  return s + '</svg>';
}

// ---------------------------------------------------------------- the far skyline (light at dusk, deeper as you go down)
function skyline(c) {
  seed = 41;
  let s = `<svg viewBox="0 0 1440 360" preserveAspectRatio="xMidYMax slice">`;
  // farthest jagged band
  let pts = '0,360 0,200';
  for (let x = 0; x <= 1440; x += 40) pts += ` ${x},${150 + Math.round(rnd() * 70)}`;
  s += `<polygon points="${pts} 1440,360" fill="${c.far}"/>`;
  for (let i = 0; i < 70; i++) s += `<rect x="${(rnd() * 1440) | 0}" y="${(230 + rnd() * 120) | 0}" width="3" height="4" fill="${c.win[0]}" opacity=".55"/>`;
  // mid towers with ledges, windows, antennas and tanks
  let x = -20;
  while (x < 1460) {
    const w = 46 + rnd() * 70, h = 110 + rnd() * 150, t = 360 - h;
    s += `<polygon points="${x},360 ${x},${t + 10} ${x + w * .3},${t} ${x + w},${t + 6} ${x + w},360" fill="${c.mid}"/>`;
    s += `<polygon points="${x + w * .62},360 ${x + w * .62},${t + 3} ${x + w},${t + 6} ${x + w},360" fill="#000" opacity=".16"/>`;
    for (let y = t + 30; y < 360; y += 34) s += `<rect x="${x}" y="${y}" width="${w}" height="3" fill="${c.ink}" opacity=".3"/>`;
    for (let y = t + 16; y < 350; y += 13) for (let xx = x + 6; xx < x + w - 8; xx += 11) {
      const q = rnd(); if (q < .24) s += `<rect x="${xx | 0}" y="${y | 0}" width="5" height="7" fill="${q < .17 ? c.win[0] : c.win[1]}" opacity="${c.wo}"/>`;
    }
    const r = rnd();
    if (r < .35) s += `<line x1="${x + w * .3}" y1="${t}" x2="${x + w * .3}" y2="${t - 34}" stroke="${c.ink}" stroke-width="3"/><circle cx="${x + w * .3}" cy="${t - 36}" r="3.5" fill="#FF0046" class="blink"/>`;
    else if (r < .55) s += `<rect x="${x + w * .5}" y="${t - 22}" width="20" height="22" fill="${c.ink}" opacity=".8"/><polygon points="${x + w * .5 - 3},${t - 22} ${x + w * .5 + 10},${t - 32} ${x + w * .5 + 23},${t - 22}" fill="${c.ink}" opacity=".8"/>`;
    else if (r < .65) s += `<rect x="${x + 8}" y="${t + 40}" width="${Math.min(w - 16, 40)}" height="14" fill="${c.ink}"/><rect x="${x + 11}" y="${t + 43}" width="${Math.min(w - 22, 34)}" height="8" fill="${rnd() < .5 ? '#FF0046' : '#00E86E'}" opacity=".85" class="flick"/>`;
    x += w + 4 + rnd() * 26;
  }
  return s + '</svg>';
}
const farLight = $('#farLight'), farDark = $('#farDark');
farLight.innerHTML = skyline({ far: '#d8c4fa', mid: '#b49aef', ink: '#6a47c9', win: ['#fff4b8', '#c8f6ff'], wo: .7 });
farDark.innerHTML = skyline({ far: '#7e63d6', mid: '#5a3bb5', ink: '#24123f', win: ['#ffe27a', '#4ce0ff'], wo: .85 });

// ---------------------------------------------------------------- the two buildings
const colR = $('#colR'), colL = $('#colL'), world = $('#world');
colR.style.setProperty('--tile', svgURI(facade(120, 960, ['#ffe27a', '#4ce0ff', '#ff7ab8'], 11)));
colL.style.setProperty('--tile', svgURI(facade(120, 840, ['#ffe27a', '#4ce0ff', '#ff7ab8'], 23)));

const sec = id => document.getElementById(id);
// things stuck to the buildings: [building, kind, section, fraction down it, label, neon colour]
const DECO = [
  [colR, 'ac', 'talk', .15], [colR, 'mini-sign', 'talk', .55, '24/7', '#4CE0FF'], [colR, 'ac', 'listen', .3], [colR, 'vent', 'listen', .78],
  [colR, 'mini-sign', 'dock', .12, 'HOTEL', '#FF5FD2'], [colR, 'ac', 'dock', .75], [colR, 'ac', 'street', .3],
  [colL, 'ac', 'listen', .15], [colL, 'mini-sign', 'listen', .62, 'RAMEN', '#FFD23F'], [colL, 'ac', 'dock', .5], [colL, 'mini-sign', 'street', .25, 'BAR', '#00E86E'],
];
const decoEls = DECO.map(([col, kind, , , label, n]) => {
  const d = document.createElement('i'); d.className = 'deco ' + kind;
  if (label) { d.textContent = label; d.style.setProperty('--n', n); }
  col.appendChild(d); return d;
});
// wires: [section, fraction, sag, from ('l' building, 'r' building or 'edge'), extra]
const WIRES = [
  ['hero', .8, 70, 'edge'], ['hero', .86, 40, 'edge'],
  ['talk', .31, 90, 'l'], ['talk', .35, 55, 'l'],
  ['dock', -.03, 80, 'l', { sign: 'LIVE', n: '#FF0046' }],
  ['street', .2, 70, 'l', { bulbs: true }], ['street', .24, 40, 'l'],
];
const wireEls = WIRES.map(() => {
  const w = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); w.setAttribute('class', 'wire');
  w.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'path')); world.appendChild(w); return w;
});
const extras = [];

function layout() {
  const hero = sec('hero'), talk = sec('talk'), street = sec('street'), walk = $('#sidewalk');
  const ground = street.offsetTop + walk.offsetTop + 26;            // where the buildings stand
  const roofR = hero.offsetTop + hero.offsetHeight * (innerWidth < 760 ? .72 : .6);
  const roofL = talk.offsetTop + talk.offsetHeight * .3;
  colR.style.top = roofR + 'px'; colR.style.height = ground - roofR + 'px';
  colL.style.top = roofL + 'px'; colL.style.height = ground - roofL + 'px';
  const esc = colL.querySelector('.escape');
  esc.style.top = (sec('listen').offsetTop - roofL + 80) + 'px';
  esc.style.height = Math.max(0, street.offsetTop + street.offsetHeight * .45 - sec('listen').offsetTop - 80) + 'px';

  DECO.forEach(([col, , id, f], i) => {
    const s = sec(id), y = s.offsetTop + s.offsetHeight * f - parseFloat(col.style.top);
    decoEls[i].style.top = Math.max(30, y) + 'px';
  });

  extras.forEach(e => e.remove()); extras.length = 0;
  const W = world.clientWidth, lR = colR.offsetLeft, lL = colL.offsetLeft + colL.offsetWidth;
  WIRES.forEach(([id, f, sag, from, extra], i) => {
    const s = sec(id), y = s.offsetTop + s.offsetHeight * f;
    const x1 = from === 'edge' ? -10 : lL, x2 = lR, w = x2 - x1;
    const el = wireEls[i];
    el.style.left = x1 + 'px'; el.style.top = y + 'px'; el.style.width = w + 'px'; el.style.height = sag + 4 + 'px';
    el.setAttribute('viewBox', `0 0 ${w} ${sag + 4}`);
    el.firstChild.setAttribute('d', `M0 0 Q ${w / 2} ${sag * 2} ${w} 0`);
    const at = t => ({ x: x1 + w * t, y: y + 4 * sag * t * (1 - t) });
    if (extra?.bulbs) {
      const cols = ['#FF0046', '#FFD23F', '#00E86E', '#4CE0FF', '#FF5FD2'];
      for (let k = 1; k < 18; k++) {
        const p = at(k / 18), b = document.createElement('i'); b.className = 'bulb';
        b.style.left = p.x + 'px'; b.style.top = p.y + 'px'; b.style.setProperty('--b', cols[k % cols.length]); b.style.setProperty('--d', (k % 4) * .6 + 's');
        world.appendChild(b); extras.push(b);
      }
    }
    if (extra?.sign) {
      const p = at(.5), h = document.createElement('i'); h.className = 'hang mini-sign'; h.textContent = extra.sign;
      h.style.setProperty('--n', extra.n); h.style.left = p.x + 'px'; h.style.top = p.y + 'px';
      world.appendChild(h); extras.push(h);
    }
  });
}

// ---------------------------------------------------------------- the far skyline rises a little and darkens as you go down
function onScroll() {
  const max = document.documentElement.scrollHeight - innerHeight, p = max > 0 ? scrollY / max : 0;
  const k = Math.min(1, Math.max(0, (p - .18) / .5));
  farDark.style.opacity = k * k * (3 - 2 * k);
  if (!reduced) {
    const y = (1 - p) * 6;
    farLight.style.transform = farDark.style.transform = `translateY(${y}vh)`;
  }
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => { layout(); onScroll(); });
addEventListener('load', layout);
new ResizeObserver(layout).observe(document.querySelector('main'));
layout(); onScroll();
})();
