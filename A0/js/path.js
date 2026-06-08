/* ===== A0 LESSON PATH — sinusoidal map ===== */

(function () {
  'use strict';

  const DATA_URL  = 'kaz-content/grammar_full.json';
  const STORE_KEY = 'a0-progress';

  const COLORS = [
    ['#58cc02','#46a302'],
    ['#1cb0f6','#0e8bc7'],
    ['#ff9600','#cc7800'],
    ['#ce82ff','#9c44e8'],
    ['#ff4b4b','#d92b2b'],
    ['#00b8a9','#008a7e'],
    ['#ffc800','#cc9f00'],
  ];

  // Layout constants
  const NODE_SPACING   = 100;  // vertical px between consecutive nodes
  const CHAPTER_GAP    = 56;   // extra px for chapter banner before first node
  const WAVELENGTH     = 380;  // px for one full sine period
  const AMPLITUDE_FRAC = 0.27; // fraction of container width for sine amplitude
  const MAX_AMPLITUDE  = 110;  // px cap
  const PADDING_TOP    = 20;
  const PADDING_BOTTOM = 80;
  const NODE_R         = 32;   // radius of node circle (= circle diameter / 2)

  let sections = [];
  let progress = {};
  let renderScheduled = false;

  function loadProgress() {
    try { progress = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch { progress = {}; }
  }
  function isDone(id) { return progress[id] === 'done'; }

  function buildOrder(raw) {
    const tops = raw.filter(s => !s.parentId);
    const result = [];
    for (const top of tops) {
      result.push({ ...top, isTop: true });
      raw.filter(s => s.parentId === top.id).forEach(c => result.push({ ...c, isTop: false }));
    }
    return result;
  }

  function getStatus(section, ordered) {
    if (isDone(section.id)) return 'done';
    const idx = ordered.findIndex(s => s.id === section.id);
    if (idx === 0) return 'available';
    if (isDone(ordered[idx - 1].id)) return 'available';
    return 'locked';
  }

  function hexAlpha(hex, a) {
    const byte = Math.round(a * 255).toString(16).padStart(2, '0');
    return hex + byte;
  }

  function render() {
    renderScheduled = false;
    const list = document.getElementById('a0-path-list');
    const statsEl = document.getElementById('a0-stats');
    if (!list) return;

    const ordered = buildOrder(sections);
    const done = ordered.filter(s => isDone(s.id)).length;
    if (statsEl) statsEl.textContent = `${done} / ${ordered.length} пройдено`;

    // Group by chapter
    const groups = [];
    for (const s of ordered) {
      if (s.isTop) groups.push({ nodes: [s], color: COLORS[groups.length % COLORS.length] });
      else groups[groups.length - 1].nodes.push(s);
    }

    const cw = list.offsetWidth || 380;
    const cx = cw / 2;
    const amp = Math.min(cw * AMPLITUDE_FRAC, MAX_AMPLITUDE);

    function sineX(y) {
      return cx + amp * Math.sin(y / WAVELENGTH * 2 * Math.PI);
    }

    // ── Compute y-positions for all items ──────────────────────────────────
    let y = PADDING_TOP;
    const items = [];   // { type, y, data, color }
    let nodeNum = 0;

    for (const { nodes, color } of groups) {
      items.push({ type: 'banner', y, color, title: nodes[0].title });
      y += CHAPTER_GAP;
      for (const s of nodes) {
        items.push({ type: 'node', y, color, data: s, num: ++nodeNum });
        y += NODE_SPACING;
      }
    }
    const totalHeight = y + PADDING_BOTTOM;

    // ── Chapter background bands & SVG paths ───────────────────────────────
    // Bands stretch to full viewport width via JS-computed offset
    const containerRect = list.getBoundingClientRect();
    const bandLeft  = -Math.round(containerRect.left);
    const bandWidth = window.innerWidth;

    let bandHtml = '';
    let svgPaths = '';

    // Compute seamless band boundaries: each band ends exactly where next starts
    const bandTops = [];
    {
      let bt = PADDING_TOP;
      for (const { nodes } of groups) {
        bandTops.push(bt);
        bt += CHAPTER_GAP + nodes.length * NODE_SPACING;
      }
      bandTops.push(totalHeight); // sentinel for last band bottom
    }

    for (let gi = 0; gi < groups.length; gi++) {
      const { nodes, color } = groups[gi];
      const [bg] = color;
      const bt  = bandTops[gi];
      const bh  = bandTops[gi + 1] - bt;

      bandHtml += `<div class="map-band" style="left:${bandLeft}px;width:${bandWidth}px;top:${bt}px;height:${bh}px;background:${hexAlpha(bg, 0.10)}"></div>`;

      // Sine path for this chapter (from first to last node y)
      const pStart = bt + CHAPTER_GAP;
      const pEnd   = pStart + (nodes.length - 1) * NODE_SPACING;
      if (nodes.length > 1) {
        let d = '';
        for (let py = pStart; py <= pEnd + 2; py += 3) {
          const px = sineX(py);
          d += d === '' ? `M${px.toFixed(1)},${py}` : ` L${px.toFixed(1)},${py}`;
        }
        svgPaths += `<path d="${d}" fill="none" stroke="${bg}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/>`;
      }
    }

    // ── Node & banner HTML ─────────────────────────────────────────────────
    let nodeHtml = '';
    for (const item of items) {
      const [bg, sh] = item.color;
      if (item.type === 'banner') {
        nodeHtml += `<div class="map-banner-abs" style="top:${item.y}px;color:${bg};background:${hexAlpha(bg, 0.12)};border-color:${hexAlpha(bg, 0.4)}">${item.title}</div>`;
      } else {
        const s = item.data;
        const status = getStatus(s, ordered);
        const href = status !== 'locked' ? `lesson.html?id=${s.id}` : null;
        const content = status === 'done' ? '✓' : item.num;
        const nx = sineX(item.y).toFixed(1);
        const ny = (item.y - NODE_R).toFixed(1);

        const circleStyle =
          status === 'done'   ? `background:#58cc02;box-shadow:0 5px 0 #46a302` :
          status === 'locked' ? `background:#e5e7eb;box-shadow:0 5px 0 #c4c9d4;color:#9ca3af` :
          `background:${bg};box-shadow:0 5px 0 ${sh}`;

        const tag = href ? 'a' : 'div';
        const hrefStr = href ? ` href="${href}"` : '';

        nodeHtml += `<${tag}${hrefStr} class="map-node ${status}" style="left:${nx}px;top:${ny}px">
          <div class="map-node-circle" style="${circleStyle}">${content}</div>
          <div class="map-node-label">${s.title}</div>
        </${tag}>`;
      }
    }

    list.innerHTML = `
      <div class="map-container" style="height:${totalHeight}px">
        ${bandHtml}
        <svg class="map-svg" viewBox="0 0 ${cw} ${totalHeight}" preserveAspectRatio="none" style="width:${cw}px;height:${totalHeight}px">
          ${svgPaths}
        </svg>
        ${nodeHtml}
      </div>`;
  }

  function scheduleRender() {
    if (!renderScheduled) {
      renderScheduled = true;
      requestAnimationFrame(render);
    }
  }

  window.addEventListener('resize', scheduleRender);

  async function init() {
    loadProgress();
    try {
      const resp = await fetch(DATA_URL);
      const data = await resp.json();
      sections = data.sections;
      render();
    } catch (e) {
      const list = document.getElementById('a0-path-list');
      if (list) list.innerHTML = '<div class="a0-loading">Ошибка загрузки данных.</div>';
      console.error(e);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
}());
