/* ===== A0 LESSON PATH — sinusoidal map ===== */

(function () {
  'use strict';

  const DATA_URL  = 'kaz-content/grammar_full.json';
  const STORE_KEY = 'a0-progress';
  const WORDS_KEY = 'a0-words';
  const SEEN_KEY  = 'a0-seen';

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
  const CHAPTER_GAP    = 84;   // px from band top to first node center (must exceed BANNER_H + NODE_R)
  const BANNER_HALF    = 18;   // half of banner pill height — used to straddle section boundaries
  const WAVELENGTH     = 380;  // px for one full sine period
  const AMPLITUDE_FRAC = 0.27; // fraction of container width for sine amplitude
  const MAX_AMPLITUDE  = 110;  // px cap
  const PADDING_TOP    = 0;
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
    let isFirstGroup = true;

    for (const { nodes, color } of groups) {
      items.push({ type: 'banner', y, color, title: nodes[0].title, isFirst: isFirstGroup });
      isFirstGroup = false;
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
        const bannerTop = item.isFirst ? item.y : item.y - BANNER_HALF;
        nodeHtml += `<div class="map-banner-abs" style="top:${bannerTop}px;color:${bg};background:var(--bg-page);border-color:${bg}">${item.title}</div>`;
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

  // ── Helpers ────────────────────────────────────────────────────────────────
  function shufflePath(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── Unlearned words (seen but never correctly answered) ────────────────────
  function getUnlearnedWords() {
    let seen, store;
    try { seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { seen = new Set(); }
    try { store = JSON.parse(localStorage.getItem(WORDS_KEY) || '{}'); } catch { store = {}; }
    const result = [];
    for (const sec of sections) {
      if (!sec.words) continue;
      sec.words.forEach((w, i) => {
        const key = `${sec.id}:${i}`;
        if (!seen.has(key)) return;
        const rec = store[key] || { correct: 0 };
        if (rec.correct === 0) result.push({ ...w, sid: sec.id, widx: i });
      });
    }
    return result;
  }

  function updateReviewBadge() {
    const words = getUnlearnedWords();
    const btn   = document.getElementById('review-btn');
    const badge = document.getElementById('review-badge');
    if (!btn) return;
    if (words.length > 0) {
      btn.style.display = 'flex';
      if (badge) badge.textContent = words.length;
    } else {
      btn.style.display = 'none';
    }
  }

  function recordWordInModal(sid, widx, correct) {
    try {
      const store = JSON.parse(localStorage.getItem(WORDS_KEY) || '{}');
      const key   = `${sid}:${widx}`;
      const rec   = store[key] || { correct: 0, wrong: 0 };
      if (correct) rec.correct++; else rec.wrong++;
      store[key] = rec;
      localStorage.setItem(WORDS_KEY, JSON.stringify(store));
    } catch {}
  }

  // ── Review modal ───────────────────────────────────────────────────────────
  const reviewState = { queue: [], flipped: false };

  function openReviewModal() {
    const words = getUnlearnedWords();
    if (words.length === 0) return;
    reviewState.queue   = shufflePath(words.map(w => ({ ...w, dir: Math.random() < .5 ? 'kaz' : 'ru' })));
    reviewState.flipped = false;
    const modal = document.getElementById('review-modal');
    if (modal) modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    const body = document.getElementById('review-body');
    if (body) { body.innerHTML = renderReviewCardHtml(); attachReviewCardListeners(); }
  }

  function closeReviewModal() {
    const modal = document.getElementById('review-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    updateReviewBadge();
  }

  function renderReviewCardHtml() {
    if (reviewState.queue.length === 0) {
      return `
        <div style="text-align:center;padding:40px 0">
          <div style="font-size:3.5rem;margin-bottom:16px">🎉</div>
          <div style="font-size:1.2rem;font-weight:900;margin-bottom:8px">Все повторены!</div>
          <div style="font-size:.9rem;color:var(--text-muted);font-weight:600;margin-bottom:28px">
            Слова, отмеченные «Знаю», больше не будут попадаться
          </div>
          <button class="a0-nav-btn" id="modal-done-btn" style="max-width:280px;margin:0 auto">Закрыть</button>
        </div>`;
    }
    const item = reviewState.queue[0];
    const front = item.dir === 'kaz' ? item.kaz : item.ru;
    const back  = item.dir === 'kaz' ? item.ru  : item.kaz;
    const frontLang = item.dir === 'kaz' ? '🇰🇿 Казахский' : '🇷🇺 Русский';
    const backLang  = item.dir === 'kaz' ? '🇷🇺 Русский'   : '🇰🇿 Казахский';
    return `
      <div style="text-align:center;margin-bottom:8px">
        <span style="font-size:.82rem;font-weight:700;color:var(--text-light)">осталось ${reviewState.queue.length}</span>
      </div>
      <div class="fc-drag-wrap" id="rev-drag" style="touch-action:none">
        <div class="fc-swipe-label fc-swipe-know">ЗНАЮ ✓</div>
        <div class="fc-swipe-label fc-swipe-nope">✗ НЕ ЗНАЮ</div>
        <div class="fc-card-wrap">
          <div class="fc-card" id="rev-card">
            <div class="fc-card-face fc-card-front">
              <div class="fc-card-lang">${frontLang}</div>
              <div class="fc-card-text">${front}</div>
              <div class="fc-flip-hint">Тап — перевернуть</div>
            </div>
            <div class="fc-card-face fc-card-back">
              <div class="fc-card-lang">${backLang}</div>
              <div class="fc-card-text">${back}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="fc-swipe-hint-row" style="margin-bottom:12px">
        <span class="fc-hint-nope">← Не знаю</span>
        <span class="fc-hint-know">Знаю →</span>
      </div>
      <div id="rev-actions" style="display:none;gap:10px">
        <button class="a0-nav-btn" id="btn-rev-wrong" style="background:var(--error);flex:1;margin-top:0">✗ Не знаю</button>
        <button class="a0-nav-btn" id="btn-rev-know"  style="background:var(--success);flex:1;margin-top:0">✓ Знаю!</button>
      </div>`;
  }

  function attachReviewCardListeners() {
    const body     = document.getElementById('review-body');
    const dragWrap = document.getElementById('rev-drag');
    const card     = document.getElementById('rev-card');

    const doneBtn = document.getElementById('modal-done-btn');
    if (doneBtn) doneBtn.addEventListener('click', closeReviewModal);
    if (!dragWrap || !card) return;

    const THRESHOLD = 80;
    let startX = 0, currentX = 0, active = false, hasMoved = false;
    const knowLabel = dragWrap.querySelector('.fc-swipe-know');
    const nopeLabel = dragWrap.querySelector('.fc-swipe-nope');

    function revKnow() {
      const item = reviewState.queue.shift();
      if (item) recordWordInModal(item.sid, item.widx, true);
      reviewState.flipped = false;
      updateReviewBadge();
      if (body) { body.innerHTML = renderReviewCardHtml(); attachReviewCardListeners(); }
    }

    function revWrong() {
      const item = reviewState.queue.shift();
      if (item) {
        reviewState.queue.push({ ...item, dir: item.dir === 'kaz' ? 'ru' : 'kaz' });
        recordWordInModal(item.sid, item.widx, false);
      }
      reviewState.flipped = false;
      if (body) { body.innerHTML = renderReviewCardHtml(); attachReviewCardListeners(); }
    }

    dragWrap.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      startX = e.clientX; currentX = 0;
      active = true; hasMoved = false;
      dragWrap.setPointerCapture(e.pointerId);
      dragWrap.style.transition = 'none';
    });

    dragWrap.addEventListener('pointermove', e => {
      if (!active) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 8) hasMoved = true;
      currentX = dx;
      dragWrap.style.transform = `translateX(${dx}px) rotate(${dx * 0.06}deg)`;
      const ratio = Math.min(Math.abs(dx) / THRESHOLD, 1);
      if (knowLabel) knowLabel.style.opacity = dx > 0 ? ratio : 0;
      if (nopeLabel) nopeLabel.style.opacity = dx < 0 ? ratio : 0;
    });

    dragWrap.addEventListener('pointerup', () => {
      if (!active) return;
      active = false;
      if (!hasMoved) {
        dragWrap.style.transition = '';
        dragWrap.style.transform  = '';
        if (!reviewState.flipped) {
          reviewState.flipped = true;
          card.classList.add('flipped');
          const actions = document.getElementById('rev-actions');
          if (actions) actions.style.display = 'flex';
        }
        return;
      }
      if (currentX > THRESHOLD) {
        dragWrap.style.transition = 'transform .35s ease-in';
        dragWrap.style.transform  = `translateX(${window.innerWidth}px) rotate(25deg)`;
        if (knowLabel) knowLabel.style.opacity = 1;
        setTimeout(revKnow, 350);
      } else if (currentX < -THRESHOLD) {
        dragWrap.style.transition = 'transform .35s ease-in';
        dragWrap.style.transform  = `translateX(-${window.innerWidth}px) rotate(-25deg)`;
        if (nopeLabel) nopeLabel.style.opacity = 1;
        setTimeout(revWrong, 350);
      } else {
        dragWrap.style.transition = 'transform .3s cubic-bezier(.25,.8,.25,1)';
        dragWrap.style.transform  = '';
        if (knowLabel) knowLabel.style.opacity = 0;
        if (nopeLabel) nopeLabel.style.opacity = 0;
      }
    });

    dragWrap.addEventListener('lostpointercapture', () => { active = false; });

    const btnKnow  = document.getElementById('btn-rev-know');
    const btnWrong = document.getElementById('btn-rev-wrong');
    if (btnKnow)  btnKnow.addEventListener('click', revKnow);
    if (btnWrong) btnWrong.addEventListener('click', revWrong);
  }

  // ── Reset progress ─────────────────────────────────────────────────────────
  function setupResetConfirm() {
    const input = document.getElementById('reset-input');
    const btn   = document.getElementById('reset-confirm-btn');
    if (!input || !btn) return;

    input.addEventListener('input', () => {
      btn.style.display = input.value.trim() === 'Сбросить весь прогресс' ? 'block' : 'none';
    });

    btn.addEventListener('click', () => {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('a0-')) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
      progress = {};
      input.value = '';
      btn.style.display = 'none';
      render();
      updateReviewBadge();
    });
  }

  async function init() {
    loadProgress();
    try {
      const resp = await fetch(DATA_URL);
      const data = await resp.json();
      sections = data.sections;
      render();
      updateReviewBadge();
    } catch (e) {
      const list = document.getElementById('a0-path-list');
      if (list) list.innerHTML = '<div class="a0-loading">Ошибка загрузки данных.</div>';
      console.error(e);
    }

    const reviewBtn   = document.getElementById('review-btn');
    const reviewClose = document.getElementById('review-close');
    if (reviewBtn)   reviewBtn.addEventListener('click', openReviewModal);
    if (reviewClose) reviewClose.addEventListener('click', closeReviewModal);
    setupResetConfirm();
  }

  document.addEventListener('DOMContentLoaded', init);
}());
