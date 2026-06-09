/* ===== REUSABLE DISPLAY COMPONENTS ===== */
/* These render theory content: alphabet, grammar tables, vocab, etc. */

window.KazComponents = (function () {

  /* ---- Helpers ---- */
  function esc(str) {
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  /* ============================================================
     GOALS BLOCK
     ============================================================ */
  function renderGoals(block) {
    const items = block.items.map(i => `<li>${esc(i)}</li>`).join('');
    return `<div class="goals-block"><ul>${items}</ul></div>`;
  }

  /* ============================================================
     TASK AFTER LESSON
     ============================================================ */
  function renderTaskAfterLesson(block) {
    const items = block.items.map(i => `<li>${esc(i)}</li>`).join('');
    return `<div class="task-after-lesson">
      <h4>${esc(block.title)}</h4>
      <ul>${items}</ul>
    </div>`;
  }

  /* ============================================================
     SUBTITLE
     ============================================================ */
  function renderSubtitle(block) {
    return `<p class="block-subtitle">${esc(block.text)}</p>`;
  }

  /* ============================================================
     ALPHABET GRID
     ============================================================ */
  function renderAlphabetGrid(block) {
    const specialSet = new Set(block.special);
    const cells = block.letters.map(l => {
      const firstLetter = l.charAt(0);
      const cls = specialSet.has(firstLetter) ? 'letter-cell special' : 'letter-cell';
      return `<div class="${cls}" title="${firstLetter}">${esc(l)}</div>`;
    }).join('');

    return `
      <div>
        <div class="alphabet-stats">${esc(block.stats)}</div>
        <div class="alphabet-grid">${cells}</div>
      </div>`;
  }

  /* ============================================================
     LETTER DETAILS (vowels / consonants)
     ============================================================ */
  function renderLetterDetails(block) {
    const rows = block.rows.map(r => `
      <tr>
        <td>${esc(r.letter)}</td>
        <td>${esc(r.desc)}</td>
        <td>${esc(r.example)}</td>
      </tr>`).join('');
    return `
      <div class="grammar-table-wrap">
        <table class="letter-detail-table">
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  /* ============================================================
     GRAMMAR TABLE
     ============================================================ */
  function renderGrammarTable(block) {
    const note = block.note ? `<p class="grammar-note">${esc(block.note)}</p>` : '';
    const title = block.title ? `<p class="block-subtitle">${esc(block.title)}</p>` : '';
    const ths = block.headers.map(h => `<th>${esc(h)}</th>`).join('');
    const rows = block.rows.map(row => {
      const tds = row.map((cell, i) => {
        const cls = i === 0 ? '' : (i % 2 === 1 ? ' class="kz-text"' : ' class="ru-text"');
        return `<td${cls}>${esc(cell)}</td>`;
      }).join('');
      return `<tr>${tds}</tr>`;
    }).join('');
    return `
      ${title}${note}
      <div class="grammar-table-wrap">
        <table class="grammar-table">
          <thead><tr>${ths}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  /* ============================================================
     VOCAB TABLE
     ============================================================ */
  function renderVocabTable(block) {
    const title = block.title ? `<p class="block-subtitle">${esc(block.title)}</p>` : '';
    const rows = block.pairs.map(p => `
      <div class="vocab-row">
        <span class="kz">${esc(p.kz)}</span>
        <span class="ru">${esc(p.ru)}</span>
      </div>`).join('');
    return `${title}<div class="vocab-table-wrap">${rows}</div>`;
  }

  /* ============================================================
     DIALOGUE EXAMPLES
     ============================================================ */
  function renderDialogueExamples(block) {
    const cards = block.examples.map(ex => {
      const lines = ex.lines.map(l => `<div class="dialogue-line">${esc(l)}</div>`).join('');
      return `
        <div class="dialogue-example-card">
          <div class="dialogue-example-label">${esc(ex.label)}</div>
          <div class="dialogue-example-lines">${lines}</div>
        </div>`;
    }).join('');
    return `<div class="dialogue-examples">${cards}</div>`;
  }

  /* ============================================================
     DIALOGUE PAIRS (Q & A side by side)
     ============================================================ */
  function renderDialoguePairs(block) {
    const pairs = block.pairs.map(p => `
      <div class="dialogue-pair">
        <div class="dialogue-pair-label">${esc(p.label)}</div>
        <div class="dialogue-pair-line">
          <div class="dp-q">${esc(p.q)}</div>
          <div class="dp-a">${esc(p.a)}</div>
        </div>
      </div>`).join('');
    return `<div class="dialogue-pairs">${pairs}</div>`;
  }

  /* ============================================================
     COLORS GRID
     ============================================================ */
  function renderColorsGrid(block) {
    const chips = block.colors.map(c => {
      const textColor = isLightColor(c.hex) ? '#3a2a1e' : '#ffffff';
      return `
        <div class="color-chip">
          <div class="color-dot" style="background:${c.hex}; border-color:${isLightColor(c.hex)?'rgba(0,0,0,.2)':'rgba(255,255,255,.3)'}"></div>
          <div>
            <div class="color-kz">${esc(c.kz)}</div>
            <div class="color-ru">${esc(c.ru)}</div>
          </div>
        </div>`;
    }).join('');
    return `<div class="colors-grid">${chips}</div>`;
  }

  function isLightColor(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return (r*299 + g*587 + b*114) / 1000 > 155;
  }

  /* ============================================================
     NUMBERS TABLE
     ============================================================ */
  function renderNumbersTable(block) {
    const cells = block.numbers.map(n => `
      <div class="number-cell">
        <span class="number-digit">${esc(String(n.num))}</span>
        <span class="number-word">${esc(n.kz)}</span>
      </div>`).join('');
    const note = block.note ? `<div class="numbers-note">${esc(block.note)}</div>` : '';
    return `<div class="numbers-grid">${cells}</div>${note}`;
  }

  /* ============================================================
     VOCAB WITH EMOJI
     ============================================================ */
  function renderVocabEmoji(block) {
    const title = block.title ? `<p class="block-subtitle">${esc(block.title)}</p>` : '';
    const cells = block.items.map(it => `
      <div class="vocab-emoji-cell">
        <span class="vocab-emoji">${it.emoji}</span>
        <div class="vocab-emoji-text">
          <div class="kz">${esc(it.kz)}</div>
          <div class="ru">${esc(it.ru)}</div>
        </div>
      </div>`).join('');
    return `${title}<div class="vocab-emoji-grid">${cells}</div>`;
  }

  /* ============================================================
     IMAGE BLOCK
     ============================================================ */
  function renderImage(block) {
    const src = esc(block.src);
    const alt = esc(block.alt || '');
    const caption = block.caption ? `<p class="lesson-image-caption">${esc(block.caption)}</p>` : '';
    return `<div class="lesson-image-wrap"><img src="${src}" alt="${alt}" class="lesson-image">${caption}</div>`;
  }

  /* ============================================================
     CALLOUT BLOCK
     ============================================================ */
  function renderCallout(block) {
    return `<div class="callout-block">${esc(block.text)}</div>`;
  }

  /* ============================================================
     VIDEO BLOCK (YouTube embed)
     ============================================================ */
  function renderVideo(block) {
    const id    = esc(block.youtubeId);
    const title = esc(block.title || 'Видео урок');
    const url   = `https://www.youtube.com/watch?v=${id}`;
    const thumb = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    return `
      <a href="${url}" target="_blank" rel="noopener" class="video-link-card" aria-label="${title}">
        <div class="video-link-thumb">
          <img src="${thumb}" alt="${title}">
          <div class="video-link-play">&#9654;</div>
        </div>
        <div class="video-link-label">${title}</div>
      </a>`;
  }

  /* ============================================================
     LINK CARD BLOCK (external link, e.g. Telegram)
     ============================================================ */
  function renderLinkCard(block) {
    const url   = esc(block.url);
    const title = esc(block.title || 'Ссылка');
    const label = esc(block.label || 'Открыть →');
    return `
      <a href="${url}" target="_blank" rel="noopener" class="tg-link-card" aria-label="${title}">
        <div class="tg-link-icon"></div>
        <div class="tg-link-text">
          <div class="tg-link-title">${title}</div>
          <div class="tg-link-label">${label}</div>
        </div>
      </a>`;
  }

  /* ============================================================
     MAIN DISPATCH: render a single block
     ============================================================ */
  function renderBlock(block) {
    switch (block.type) {
      case 'goals':             return renderGoals(block);
      case 'task-after-lesson': return renderTaskAfterLesson(block);
      case 'subtitle':          return renderSubtitle(block);
      case 'alphabet-grid':     return renderAlphabetGrid(block);
      case 'letter-details':    return renderLetterDetails(block);
      case 'grammar-table':     return renderGrammarTable(block);
      case 'vocab-table':       return renderVocabTable(block);
      case 'dialogue-examples': return renderDialogueExamples(block);
      case 'dialogue-pairs':    return renderDialoguePairs(block);
      case 'colors-grid':       return renderColorsGrid(block);
      case 'numbers-table':     return renderNumbersTable(block);
      case 'vocab-emoji':       return renderVocabEmoji(block);
      case 'callout':           return renderCallout(block);
      case 'image':             return renderImage(block);
      case 'video':             return renderVideo(block);
      case 'link-card':         return renderLinkCard(block);
      case 'exercise':          return ''; // handled separately
      default:
        return `<p style="color:red">Unknown block type: ${esc(block.type)}</p>`;
    }
  }

  /* ============================================================
     RENDER SECTION
     ============================================================ */
  function renderSection(section, index) {
    const bodyBlocks = section.blocks.map(b => {
      if (b.type === 'exercise') {
        return `<div class="exercise-placeholder" data-exercise-id="${esc(b.exercise.id)}"></div>`;
      }
      return renderBlock(b);
    }).join('');

    const collapseClass = index > 0 ? '' : ''; // all open by default
    return `
      <div class="section-block" id="section-${esc(section.id)}">
        <div class="section-header" onclick="KazLesson.toggleSection(this)">
          <span class="section-icon">${section.icon}</span>
          <span class="section-title">${esc(section.title)}</span>
          <span class="section-toggle">▾</span>
        </div>
        <div class="section-body">${bodyBlocks}</div>
      </div>`;
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */
  return {
    renderBlock,
    renderSection,
    renderCallout,
    renderVideo,
    renderLinkCard,
    esc,
  };

}());
