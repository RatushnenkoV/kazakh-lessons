/* ===== A0 LESSON PATH ===== */

(function () {
  'use strict';

  const DATA_URL  = 'kaz-content/grammar_parsed.json';
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
  const POSITIONS = ['center', 'right', 'center', 'left'];

  let sections = [];
  let progress = {};

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

  function render() {
    const list = document.getElementById('a0-path-list');
    const statsEl = document.getElementById('a0-stats');
    if (!list) return;

    const ordered = buildOrder(sections);
    const done = ordered.filter(s => isDone(s.id)).length;
    if (statsEl) statsEl.textContent = `${done} / ${ordered.length} пройдено`;

    // Group into chapters by top-level section
    const groups = [];
    for (const s of ordered) {
      if (s.isTop) {
        groups.push({ nodes: [s], color: COLORS[groups.length % COLORS.length] });
      } else {
        groups[groups.length - 1].nodes.push(s);
      }
    }

    let posIdx = 0;
    let num = 0;
    const html = [];

    for (const { nodes, color } of groups) {
      const [bg, sh] = color;

      html.push(`<div class="map-banner" style="background:${bg}20;border-color:${bg}55;color:${bg}">${nodes[0].title}</div>`);

      for (let i = 0; i < nodes.length; i++) {
        const s = nodes[i];
        num++;
        const pos = POSITIONS[posIdx % POSITIONS.length];
        posIdx++;
        const status = getStatus(s, ordered);
        const href = status !== 'locked' ? `lesson.html?id=${s.id}` : null;
        const content = status === 'done' ? '✓' : num;

        const circleStyle =
          status === 'done'   ? 'background:#58cc02;box-shadow:0 5px 0 #46a302' :
          status === 'locked' ? 'background:#e5e7eb;box-shadow:0 5px 0 #c4c9d4;color:#9ca3af' :
          `background:${bg};box-shadow:0 5px 0 ${sh}`;

        const tag = href ? 'a' : 'div';
        const hrefStr = href ? ` href="${href}"` : '';

        html.push(`
          <div class="map-node-row pos-${pos}">
            <${tag}${hrefStr} class="map-node ${status}">
              <div class="map-node-circle" style="${circleStyle}">${content}</div>
              <div class="map-node-label">${s.title}</div>
            </${tag}>
          </div>`);

        if (i < nodes.length - 1) {
          html.push(`<div class="map-seg" style="background:${bg}"></div>`);
        }
      }
    }

    list.innerHTML = html.join('');
  }

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
