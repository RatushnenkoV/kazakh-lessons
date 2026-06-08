/* ===== A0 LESSON PATH ===== */
/* Loads grammar_parsed.json, renders lesson list with progress */

(function () {
  'use strict';

  const DATA_URL  = 'kaz-content/grammar_parsed.json';
  const STORE_KEY = 'a0-progress'; // { sectionId: 'done' }

  // ── Chapters: group parentId=null sections as chapter headers ──────────────
  // Subsections (parentId != null) appear under their parent inline.
  // We display them indented within the same chapter.

  let sections = [];
  let progress = {};

  function loadProgress() {
    try { progress = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch { progress = {}; }
  }

  function isDone(id) { return progress[id] === 'done'; }

  // Build ordered list: top-level sections, each followed by their children
  function buildOrder(rawSections) {
    const tops = rawSections.filter(s => !s.parentId);
    const result = [];
    for (const top of tops) {
      result.push({ ...top, isTop: true });
      const children = rawSections.filter(s => s.parentId === top.id);
      for (const child of children) {
        result.push({ ...child, isTop: false });
      }
    }
    return result;
  }

  function getStatus(section, orderedList) {
    if (isDone(section.id)) return 'done';
    // First section is always available; others unlock after previous is done
    const idx = orderedList.findIndex(s => s.id === section.id);
    if (idx === 0) return 'available';
    const prev = orderedList[idx - 1];
    if (isDone(prev.id)) return 'available';
    return 'locked';
  }

  function metaText(section) {
    const parts = [];
    if (section.words.length)     parts.push(`${section.words.length} слов`);
    if (section.sentences.length) parts.push(`${section.sentences.length} примеров`);
    if (section.relatedVideos.length) parts.push('Видео');
    return parts.join(' · ') || 'Объяснение';
  }

  function render() {
    const list = document.getElementById('a0-path-list');
    const statsEl = document.getElementById('a0-stats');
    if (!list) return;

    const ordered = buildOrder(sections);
    const total = ordered.length;
    const done  = ordered.filter(s => isDone(s.id)).length;

    if (statsEl) statsEl.textContent = `${done} / ${total} пройдено`;

    // Track current chapter for labels
    let currentChapter = null;
    let num = 0;
    const rows = [];

    for (const section of ordered) {
      num++;
      const status = getStatus(section, ordered);

      // Chapter label for top-level sections
      if (section.isTop) {
        currentChapter = section;
      }

      const statusIcon = status === 'done'      ? '✓'
                       : status === 'available' ? '→'
                       : '🔒';
      const statusClass = status === 'done'      ? 'completed'
                        : status === 'available' ? 'active-next'
                        : 'locked';

      const href = status !== 'locked'
        ? `lesson.html?id=${section.id}`
        : '#';

      const indent = section.isTop ? '' : 'a0-lesson-row--sub';

      rows.push(`
        <a href="${href}" class="a0-lesson-row ${statusClass} ${indent}">
          <div class="a0-lesson-num">${status === 'done' ? '✓' : num}</div>
          <div class="a0-lesson-info">
            <div class="a0-lesson-title">${section.title}</div>
            <div class="a0-lesson-meta">${metaText(section)}</div>
          </div>
          <div class="a0-lesson-status">${statusIcon}</div>
        </a>`);
    }

    list.innerHTML = rows.join('');
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
