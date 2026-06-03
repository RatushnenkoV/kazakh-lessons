/* ===== INTERACTIVE EXERCISE COMPONENTS ===== */

window.KazExercises = (function () {

  const esc = KazComponents.esc;

  /* ---- Color palette for matched pairs ---- */
  const MATCH_COLORS = [
    { border:'#d4705a', bg:'#fde8e4', text:'#9a2e18' },
    { border:'#6fa086', bg:'#ddf0e8', text:'#205e3a' },
    { border:'#9580c8', bg:'#ede0f8', text:'#4a28a0' },
    { border:'#e9a83a', bg:'#fdf0c8', text:'#7a5808' },
    { border:'#4a8bb5', bg:'#daeaf8', text:'#1a4878' },
    { border:'#c86a9a', bg:'#f8dce8', text:'#802858' },
    { border:'#52a872', bg:'#d4f0e4', text:'#1e5c3a' },
    { border:'#d48050', bg:'#fce4d0', text:'#7a3818' },
  ];

  /* Track pair color index per exercise */
  const matchColorCounts = {};

  /* ---- Confetti ---- */
  function confettiBurst(x, y) {
    const colors = ['#d4705a','#e9b94a','#6fa086','#b09fce','#e87070'];
    for (let i = 0; i < 18; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.cssText = [
        `left:${x + (Math.random()-.5)*80}px`,
        `top:${y - 20}px`,
        `background:${colors[i % colors.length]}`,
        `transform:rotate(${Math.random()*360}deg)`,
        `animation-duration:${.6 + Math.random()*.6}s`,
        `animation-delay:${Math.random()*.2}s`,
      ].join(';');
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1500);
    }
  }

  /* ---- Shuffle ---- */
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length-1; i > 0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  /* ================================================================
     SVG THREAD LINE for match exercise
     ================================================================ */
  function drawMatchLine(exBlock, leftEl, rightEl, colorHex) {
    const cols = exBlock.querySelector('.match-columns');
    if (!cols) return;

    // Ensure SVG overlay exists
    let svg = cols.querySelector('.match-lines-svg');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.classList.add('match-lines-svg');
      cols.appendChild(svg);
    }

    const cRect = cols.getBoundingClientRect();
    const lRect = leftEl.getBoundingClientRect();
    const rRect = rightEl.getBoundingClientRect();

    // Positions relative to match-columns container
    const x1 = lRect.right  - cRect.left;
    const y1 = lRect.top    + lRect.height / 2 - cRect.top;
    const x2 = rRect.left   - cRect.left;
    const y2 = rRect.top    + rRect.height / 2 - cRect.top;

    const gap = Math.abs(x2 - x1);
    const cx1 = x1 + gap * 0.42;
    const cx2 = x2 - gap * 0.42;
    const d   = `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`;

    // Path
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', colorHex);
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.classList.add('match-line-path');
    svg.appendChild(path);

    // Animate using actual length
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;

    // Endpoint dots
    [[x1,y1],[x2,y2]].forEach(([cx,cy]) => {
      const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
      dot.setAttribute('cx', cx);
      dot.setAttribute('cy', cy);
      dot.setAttribute('r', '4');
      dot.setAttribute('fill', colorHex);
      dot.classList.add('match-line-dot');
      svg.appendChild(dot);
    });
  }

  /* ================================================================
     DRAG & DROP FOR FILL-DIALOG
     ================================================================ */

  /* ---- HTML5 drag events ---- */
  let activeDragChip = null;

  document.addEventListener('dragstart', e => {
    const chip = e.target.closest('.word-chip[draggable]:not(.used)');
    if (!chip) return;
    activeDragChip = chip;
    chip.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({
      chipId: chip.dataset.chipId,
      text:   chip.dataset.text,
    }));
  });

  document.addEventListener('dragend', () => {
    if (activeDragChip) activeDragChip.classList.remove('dragging');
    activeDragChip = null;
    document.querySelectorAll('.blank-slot.drag-over')
      .forEach(b => b.classList.remove('drag-over'));
  });

  document.addEventListener('dragover', e => {
    const slot = e.target.closest('.blank-slot:not(.correct)');
    if (!slot) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.blank-slot.drag-over')
      .forEach(b => b !== slot && b.classList.remove('drag-over'));
    slot.classList.add('drag-over');
  });

  document.addEventListener('dragleave', e => {
    const slot = e.target.closest('.blank-slot.drag-over');
    if (!slot) return;
    // Only remove if leaving the slot entirely (not entering a child)
    if (!slot.contains(e.relatedTarget)) slot.classList.remove('drag-over');
  });

  document.addEventListener('drop', e => {
    const slot = e.target.closest('.blank-slot:not(.correct)');
    if (!slot) { return; }
    e.preventDefault();
    slot.classList.remove('drag-over');

    let chipId, text;
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      chipId = data.chipId;
      text   = data.text;
    } catch { return; }

    const exBlock = slot.closest('.exercise-block');
    if (!exBlock) return;
    const chip = exBlock.querySelector(`[data-chip-id="${chipId}"]`);
    if (!chip) return;

    // If slot already filled, return old chip to bank
    if (slot.dataset.chipId) {
      const old = exBlock.querySelector(`[data-chip-id="${slot.dataset.chipId}"]`);
      if (old) old.classList.remove('used');
    }

    fillSlot(slot, chip, text);
  });

  /* ---- Touch drag events ---- */
  let touchDragChip = null;
  let touchGhost    = null;

  document.addEventListener('touchstart', e => {
    const chip = e.target.closest('.word-chip[draggable]:not(.used)');
    if (!chip) return;
    touchDragChip = chip;

    // Create ghost
    touchGhost = document.createElement('div');
    touchGhost.className = 'touch-drag-ghost';
    touchGhost.textContent = chip.dataset.text;
    document.body.appendChild(touchGhost);

    const t = e.touches[0];
    positionGhost(t.clientX, t.clientY);
    chip.classList.add('dragging');
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!touchDragChip) return;
    e.preventDefault();

    const t = e.touches[0];
    positionGhost(t.clientX, t.clientY);

    // Highlight slot under finger
    touchGhost.style.display = 'none';
    const el = document.elementFromPoint(t.clientX, t.clientY);
    touchGhost.style.display = '';

    document.querySelectorAll('.blank-slot.drag-over')
      .forEach(b => b.classList.remove('drag-over'));
    const slot = el && el.closest('.blank-slot:not(.correct)');
    if (slot) slot.classList.add('drag-over');
  }, { passive: false });

  document.addEventListener('touchend', e => {
    if (!touchDragChip) return;
    if (touchGhost) { touchGhost.remove(); touchGhost = null; }
    touchDragChip.classList.remove('dragging');

    document.querySelectorAll('.blank-slot.drag-over')
      .forEach(b => b.classList.remove('drag-over'));

    const t     = e.changedTouches[0];
    touchGhost = null; // already removed
    const el   = document.elementFromPoint(t.clientX, t.clientY);
    const slot = el && el.closest('.blank-slot:not(.correct)');

    if (slot) {
      const exBlock = slot.closest('.exercise-block');
      if (exBlock) {
        // Return old chip if slot was filled
        if (slot.dataset.chipId) {
          const old = exBlock.querySelector(`[data-chip-id="${slot.dataset.chipId}"]`);
          if (old) old.classList.remove('used');
        }
        fillSlot(slot, touchDragChip, touchDragChip.dataset.text);
      }
    }

    touchDragChip = null;
  }, { passive: true });

  function positionGhost(cx, cy) {
    if (!touchGhost) return;
    touchGhost.style.left = `${cx - 50}px`;
    touchGhost.style.top  = `${cy - 20}px`;
  }

  /* Shared slot-fill helper */
  function fillSlot(slot, chip, text) {
    slot.textContent = text;
    slot.classList.remove('empty','wrong-ans');
    slot.classList.add('filled');
    slot.dataset.filledWith = text;
    slot.dataset.chipId     = chip.dataset.chipId;
    chip.classList.add('used');
  }

  /* ================================================================
     GLOBAL CLICK DELEGATION
     ================================================================ */
  document.addEventListener('click', e => {

    /* ---- Match: left item ---- */
    const leftItem = e.target.closest('.match-item[data-side="left"]:not(.matched)');
    if (leftItem) {
      const exBlock = leftItem.closest('.exercise-block');
      if (!exBlock) return;
      exBlock.querySelectorAll('.match-item[data-side="left"].selected')
        .forEach(el => el.classList.remove('selected'));
      leftItem.classList.add('selected');
      return;
    }

    /* ---- Match: right item ---- */
    const rightItem = e.target.closest('.match-item[data-side="right"]:not(.matched)');
    if (rightItem) {
      const exBlock = rightItem.closest('.exercise-block');
      if (!exBlock) return;
      const selLeft = exBlock.querySelector('.match-item[data-side="left"].selected');
      if (!selLeft) return;

      const exId = exBlock.id.replace('ex-','');

      if (parseInt(selLeft.dataset.pair) === parseInt(rightItem.dataset.pair)) {
        // ✓ Correct match
        const idx   = matchColorCounts[exId] = (matchColorCounts[exId] || 0);
        matchColorCounts[exId]++;
        const color = MATCH_COLORS[idx % MATCH_COLORS.length];

        // Apply pair color to items (overrides generic .matched green)
        [selLeft, rightItem].forEach(el => {
          el.style.borderColor = color.border;
          el.style.background  = color.bg;
          el.style.color       = color.text;
        });

        selLeft.classList.remove('selected');
        selLeft.classList.add('matched');
        rightItem.classList.add('matched');

        // Draw thread
        drawMatchLine(exBlock, selLeft, rightItem, color.border);

        // All matched?
        const total   = exBlock.querySelectorAll('.match-item[data-side="left"]').length;
        const matched = exBlock.querySelectorAll('.match-item[data-side="left"].matched').length;
        if (matched === total) {
          const res = document.getElementById(`${exId}-result`);
          if (res) {
            res.className = 'exercise-result success';
            res.innerHTML = '🎉 Отлично! Все пары найдены!';
            const r = res.getBoundingClientRect();
            confettiBurst(r.left + r.width/2, r.top);
          }
          matchColorCounts[exId] = 0;
        }
      } else {
        // ✗ Wrong
        rightItem.classList.add('wrong');
        selLeft.classList.remove('selected');
        selLeft.classList.add('wrong');
        setTimeout(() => {
          rightItem.classList.remove('wrong');
          selLeft.classList.remove('wrong');
        }, 600);
      }
      return;
    }

    /* ---- Fill-dialog: chip click (fallback for non-drag devices) ---- */
    const chip = e.target.closest('.word-chip:not(.used)');
    if (chip && !chip.classList.contains('dragging')) {
      const exBlock = chip.closest('.exercise-block');
      if (!exBlock) return;
      const blank = exBlock.querySelector('.blank-slot.empty');
      if (!blank) return;
      fillSlot(blank, chip, chip.dataset.text);
      return;
    }

    /* ---- Fill-dialog: filled blank click → return to bank ---- */
    const filledBlank = e.target.closest('.fill-dialog-exercise .blank-slot.filled');
    if (filledBlank) {
      const exBlock = filledBlank.closest('.exercise-block');
      if (!exBlock) return;
      const cId = filledBlank.dataset.chipId;
      if (cId) {
        const ch = exBlock.querySelector(`[data-chip-id="${cId}"]`);
        if (ch) ch.classList.remove('used');
      }
      filledBlank.textContent = '';
      filledBlank.classList.remove('filled','correct','wrong-ans');
      filledBlank.classList.add('empty');
      delete filledBlank.dataset.filledWith;
      delete filledBlank.dataset.chipId;
      return;
    }

    /* ---- Color-fill: chip click ---- */
    const colorChip = e.target.closest('.color-option-chip');
    if (colorChip) {
      const exBlock = colorChip.closest('.exercise-block');
      if (!exBlock) return;
      const blank = exBlock.querySelector('.blank-slot.empty');
      if (!blank) return;
      blank.textContent = colorChip.dataset.color;
      blank.classList.remove('empty');
      blank.classList.add('filled');
      blank.dataset.filledWith = colorChip.dataset.color;
      return;
    }

    /* ---- Color-fill: filled blank click → clear ---- */
    const colorBlank = e.target.closest('.color-fill-exercise .blank-slot.filled');
    if (colorBlank) {
      colorBlank.textContent = '';
      colorBlank.classList.remove('filled','correct','wrong-ans');
      colorBlank.classList.add('empty');
      delete colorBlank.dataset.filledWith;
      return;
    }

    /* ---- Alpha-sort: chip click ---- */
    const sortChip = e.target.closest('.sort-chip:not(.placed)');
    if (sortChip) {
      const exBlock = sortChip.closest('.exercise-block');
      if (!exBlock) return;
      const slot = exBlock.querySelector('.sort-slot-cell.empty');
      if (!slot) return;
      slot.textContent = sortChip.dataset.item;
      slot.classList.remove('empty');
      slot.dataset.value = sortChip.dataset.item;
      sortChip.classList.add('placed');
      return;
    }

    /* ---- Alpha-sort: filled slot click → return ---- */
    const sortSlot = e.target.closest('.sort-slot-cell:not(.empty):not(.correct-s):not(.wrong-s)');
    if (sortSlot) {
      const exBlock = sortSlot.closest('.exercise-block');
      if (!exBlock) return;
      const v = sortSlot.dataset.value;
      if (!v) return;
      const sc = exBlock.querySelector(`.sort-chip[data-item="${v}"].placed`);
      if (sc) sc.classList.remove('placed');
      sortSlot.textContent = '';
      sortSlot.classList.add('empty');
      delete sortSlot.dataset.value;
      return;
    }
  });

  /* ================================================================
     MATCH EXERCISE BUILD
     ================================================================ */
  function buildMatch(ex, container) {
    matchColorCounts[ex.id] = 0;
    const rights = shuffle(ex.pairs.map((p,i) => ({text:p.right, pairIdx:i})));

    const leftCols  = ex.pairs.map((p,i) => {
      const content = (typeof p.left === 'string' && p.left.startsWith('img/'))
        ? `<img src="${esc(p.left)}" class="match-item-img" alt="">`
        : esc(p.left);
      return `<div class="match-item" data-side="left" data-pair="${i}">${content}</div>`;
    }).join('');
    const rightCols = rights.map(r =>
      `<div class="match-item" data-side="right" data-pair="${r.pairIdx}">${esc(r.text)}</div>`
    ).join('');

    container.innerHTML = `
      <div class="exercise-block" id="ex-${esc(ex.id)}">
        <div class="exercise-header">
          <span class="exercise-badge">${esc(ex.title)}</span>
          <span class="exercise-instruction">${esc(ex.instruction)}</span>
        </div>
        <div class="exercise-body">
          <div class="match-exercise">
            <div class="match-columns">
              <div class="match-column">${leftCols}</div>
              <div class="match-column">${rightCols}</div>
            </div>
            <div class="exercise-result" id="${esc(ex.id)}-result"></div>
            <button class="reset-btn" onclick="KazExercises.resetExercise(this)">↺ Сбросить</button>
          </div>
        </div>
      </div>`;
    container.dataset.exJson = JSON.stringify(ex);
  }

  function resetExercise(btn) {
    const exBlock   = btn.closest('.exercise-block');
    const container = exBlock.parentElement;
    const stored    = container.dataset.exJson;
    if (!stored) return;
    buildExercise(JSON.parse(stored), container);
  }

  /* ================================================================
     FILL-DIALOG EXERCISE BUILD
     ================================================================ */
  function buildFillDialog(ex, container) {
    const bankWords = ex.wordBank.map((w,i) => ({text:w, chipId:`${ex.id}-c${i}`}));
    container.innerHTML = buildFillDialogHTML(ex, bankWords);
    container.dataset.exJson = JSON.stringify(ex);
  }

  function buildFillDialogHTML(ex, bankWords) {
    const chips = bankWords.map(w =>
      `<span class="word-chip" draggable="true"
        data-chip-id="${esc(w.chipId)}"
        data-text="${esc(w.text)}">${esc(w.text)}</span>`
    ).join('');

    const dialogBlocks = ex.dialogs.map(dialog => {
      const lines = dialog.lines.map(line => {
        if (!line.blank) return `<div class="dialog-line">${esc(line.text)}</div>`;

        const chipObj = bankWords.find(w =>
          w.text.toLowerCase() === line.blank.toLowerCase()
        );
        const blankHtml = `<span class="blank-slot empty"
          data-answer="${esc(line.blank)}"
          data-alt="${esc(line.alt||'')}"
          data-chip-id=""></span>`;
        return `<div class="dialog-line">${line.text.replace('{blank}', blankHtml)}</div>`;
      }).join('');

      return `
        <div class="dialog-block">
          <div class="dialog-block-num">Диалог ${dialog.id}</div>
          <div class="dialog-lines">${lines}</div>
        </div>`;
    }).join('');

    return `
      <div class="exercise-block" id="ex-${esc(ex.id)}">
        <div class="exercise-header">
          <span class="exercise-badge">${esc(ex.title)}</span>
          <span class="exercise-instruction">${esc(ex.instruction)}</span>
        </div>
        <div class="exercise-body">
          <div class="fill-dialog-exercise">
            <div class="word-bank">
              <div class="word-bank-label">Перетащите или нажмите слово:</div>
              ${chips}
            </div>
            <div class="dialog-blocks">${dialogBlocks}</div>
            <div class="exercise-result" id="${esc(ex.id)}-result"></div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
              <button class="dialog-check-btn"
                onclick="KazExercises.checkFillDialog('${esc(ex.id)}')">✓ Проверить</button>
              <button class="reset-btn"
                onclick="KazExercises.resetExercise(this)">↺ Сбросить</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  function checkFillDialog(exId) {
    const exBlock = document.getElementById(`ex-${exId}`);
    if (!exBlock) return;
    let correct = 0, total = 0;

    exBlock.querySelectorAll('.blank-slot').forEach(blank => {
      total++;
      const answer = (blank.dataset.answer||'').trim().toLowerCase();
      const alt    = (blank.dataset.alt||'').trim().toLowerCase();
      const filled = (blank.dataset.filledWith||'').trim().toLowerCase();

      if (filled && (filled === answer || (alt && filled === alt))) {
        blank.classList.remove('filled','wrong-ans','empty'); blank.classList.add('correct'); correct++;
      } else if (filled) {
        blank.classList.remove('filled'); blank.classList.add('wrong-ans');
      }
    });

    const res = document.getElementById(`${exId}-result`);
    if (!res) return;
    if (total > 0 && correct === total) {
      res.className = 'exercise-result success';
      res.innerHTML = '🎉 Все ответы верны!';
      confettiBurst(res.getBoundingClientRect().left + 100, res.getBoundingClientRect().top);
    } else {
      res.className = 'exercise-result partial';
      res.innerHTML = `Верных: ${correct} из ${total}. Попробуйте ещё!`;
    }
  }

  /* ================================================================
     ALPHA-SORT EXERCISE
     ================================================================ */
  function buildAlphaSort(ex, container) {
    const shuffled = shuffle(ex.items);
    container.innerHTML = buildAlphaSortHTML(ex, shuffled);
    container.dataset.exJson     = JSON.stringify(ex);
    container.dataset.exShuffled = JSON.stringify(shuffled);
  }

  function buildAlphaSortHTML(ex, shuffled) {
    const chips = shuffled.map(item =>
      `<span class="sort-chip" data-item="${esc(item)}">${esc(item)}</span>`
    ).join('');
    const slots = ex.correct.map((_,i) =>
      `<div class="sort-slot">
        <div class="sort-slot-num">${i+1}</div>
        <div class="sort-slot-cell empty" data-slot-idx="${i}"></div>
      </div>`
    ).join('');

    return `
      <div class="exercise-block" id="ex-${esc(ex.id)}">
        <div class="exercise-header">
          <span class="exercise-badge">${esc(ex.title)}</span>
          <span class="exercise-instruction">${esc(ex.instruction)}</span>
        </div>
        <div class="exercise-body">
          <div class="sort-exercise">
            <div class="sort-bank">
              <div class="sort-bank-label">Нажимайте слова в алфавитном порядке:</div>
              ${chips}
            </div>
            <div class="sort-slots">${slots}</div>
            <div class="exercise-result" id="${esc(ex.id)}-result"></div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
              <button class="sort-check-btn"
                onclick="KazExercises.checkAlphaSort('${esc(ex.id)}')">✓ Проверить</button>
              <button class="reset-btn"
                onclick="KazExercises.resetAlphaSort('${esc(ex.id)}')">↺ Сбросить</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  function checkAlphaSort(exId) {
    const exBlock   = document.getElementById(`ex-${exId}`);
    const container = exBlock && exBlock.parentElement;
    if (!container) return;
    const ex = JSON.parse(container.dataset.exJson || '{}');

    exBlock.querySelectorAll('.sort-slot-cell').forEach((slot,i) => {
      const v = (slot.dataset.value||'').trim().toLowerCase();
      const e2 = (ex.correct[i]||'').trim().toLowerCase();
      if (v === e2)      { slot.classList.add('correct-s'); }
      else if (v)        { slot.classList.add('wrong-s'); }
    });

    const correct = exBlock.querySelectorAll('.sort-slot-cell.correct-s').length;
    const res = document.getElementById(`${exId}-result`);
    if (!res) return;
    if (correct === ex.correct.length) {
      res.className = 'exercise-result success';
      res.innerHTML = '🎉 Алфавитный порядок верный!';
      confettiBurst(res.getBoundingClientRect().left + 100, res.getBoundingClientRect().top);
    } else {
      res.className = 'exercise-result partial';
      res.innerHTML = `Верных: ${correct} из ${ex.correct.length}. Попробуйте снова!`;
    }
  }

  function resetAlphaSort(exId) {
    const exBlock   = document.getElementById(`ex-${exId}`);
    const container = exBlock && exBlock.parentElement;
    if (!container) return;
    const ex       = JSON.parse(container.dataset.exJson || '{}');
    const shuffled = JSON.parse(container.dataset.exShuffled || '[]');
    container.innerHTML = buildAlphaSortHTML(ex, shuffled.length ? shuffled : shuffle(ex.items||[]));
    container.dataset.exJson     = JSON.stringify(ex);
    container.dataset.exShuffled = JSON.stringify(shuffled);
  }

  /* ================================================================
     COLOR-FILL EXERCISE
     ================================================================ */
  function buildColorFill(ex, container) {
    container.innerHTML = buildColorFillHTML(ex);
    container.dataset.exJson = JSON.stringify(ex);
  }

  function buildColorFillHTML(ex) {
    const chips = ex.colorOptions.map(c =>
      `<span class="color-option-chip" data-color="${esc(c)}">${esc(c)}</span>`
    ).join('');
    const questions = ex.questions.map(q => {
      let idx = 0;
      const rendered = q.text.replace(/\{blank\}/g, () =>
        `<span class="blank-slot empty" data-answer="${esc(q.blanks[idx++]||'')}"></span>`
      );
      const hintHtml = (q.hint && typeof q.hint === 'object' && q.hint.img)
        ? `<img src="${esc(q.hint.img)}" class="color-hint-img" alt="${esc(q.hint.label||'')}"><span>${esc(q.hint.label||'')}</span>`
        : esc(q.hint);
      return `
        <div class="color-question">
          <div class="color-question-hint">${hintHtml}</div>
          <div class="color-question-text">${rendered}</div>
        </div>`;
    }).join('');

    return `
      <div class="exercise-block" id="ex-${esc(ex.id)}">
        <div class="exercise-header">
          <span class="exercise-badge">${esc(ex.title)}</span>
          <span class="exercise-instruction">${esc(ex.instruction)}</span>
        </div>
        <div class="exercise-body">
          <div class="color-fill-exercise">
            <div class="color-options">
              <div class="word-bank-label">Цвета:</div>
              ${chips}
            </div>
            <div class="color-questions">${questions}</div>
            <div class="exercise-result" id="${esc(ex.id)}-result"></div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
              <button class="dialog-check-btn"
                onclick="KazExercises.checkColorFill('${esc(ex.id)}')">✓ Проверить</button>
              <button class="reset-btn"
                onclick="KazExercises.resetExercise(this)">↺ Сбросить</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  function checkColorFill(exId) {
    const exBlock = document.getElementById(`ex-${exId}`);
    if (!exBlock) return;
    let correct = 0, total = 0;

    exBlock.querySelectorAll('.blank-slot').forEach(blank => {
      total++;
      const answer = (blank.dataset.answer||'').trim().toLowerCase();
      const filled = (blank.dataset.filledWith||'').trim().toLowerCase();
      if (filled && filled === answer) {
        blank.classList.remove('filled','wrong-ans'); blank.classList.add('correct'); correct++;
      } else if (filled) {
        blank.classList.remove('filled'); blank.classList.add('wrong-ans');
      }
    });

    const res = document.getElementById(`${exId}-result`);
    if (!res) return;
    if (total > 0 && correct === total) {
      res.className = 'exercise-result success';
      res.innerHTML = '🎉 Все цвета верны!';
      confettiBurst(res.getBoundingClientRect().left + 100, res.getBoundingClientRect().top);
    } else {
      res.className = 'exercise-result partial';
      res.innerHTML = `Верных: ${correct} из ${total}. Попробуйте снова!`;
    }
  }

  /* ================================================================
     COUNT EXERCISE
     ================================================================ */
  function buildCount(ex, container) {
    const qs = ex.questions.map(q => {
      const display = q.img
        ? `<img src="${esc(q.img)}" class="count-img" alt="">`
        : Array.from({length: q.count}, () => q.emoji).join('');
      return `
        <div class="count-question">
          <div class="count-display">${display}</div>
          <div class="count-prompt">${esc(q.question)}</div>
          <div class="count-prompt-ru">${esc(q.questionRu)}</div>
          <div class="count-input-wrap">
            <input class="count-input" type="text"
              placeholder="Введите ответ на казахском..."
              data-answer="${esc(q.answer)}"
              data-qid="${q.id}" />
            <button class="count-check-btn"
              onclick="KazExercises.checkCountInput(this)">Проверить</button>
          </div>
          <div class="count-answer-reveal" id="${esc(ex.id)}-q${q.id}-reveal">
            ✓ ${esc(q.answer)}<br>
            <span style="font-weight:500;opacity:.7">${esc(q.answerRu)}</span>
          </div>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="exercise-block" id="ex-${esc(ex.id)}">
        <div class="exercise-header">
          <span class="exercise-badge">${esc(ex.title)}</span>
          <span class="exercise-instruction">${esc(ex.instruction)}</span>
        </div>
        <div class="exercise-body">
          <div class="count-exercise">${qs}</div>
        </div>
      </div>`;

    container.querySelectorAll('.count-input').forEach(inp => {
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') checkCountInput(inp.nextElementSibling);
      });
    });
  }

  function checkCountInput(btn) {
    const wrap   = btn.parentElement;
    const inp    = wrap.querySelector('.count-input');
    const qBlock = wrap.closest('.count-question');
    const reveal = qBlock && qBlock.querySelector('.count-answer-reveal');
    if (!inp) return;

    const answer = inp.dataset.answer.trim().toLowerCase();
    const value  = inp.value.trim().toLowerCase();

    if (value === answer) {
      inp.style.borderColor = 'var(--success)';
      inp.style.background  = 'var(--success-pale)';
    } else {
      inp.style.borderColor = 'var(--error)';
      inp.style.background  = 'var(--error-pale)';
      inp.style.animation   = 'shake .4s ease';
      setTimeout(() => inp.style.animation = '', 500);
    }
    if (reveal) reveal.classList.add('show');
  }

  /* ================================================================
     DISPATCHER + PUBLIC API
     ================================================================ */
  function buildExercise(ex, container) {
    switch (ex.type) {
      case 'match':       buildMatch(ex, container);      break;
      case 'fill-dialog': buildFillDialog(ex, container); break;
      case 'alpha-sort':  buildAlphaSort(ex, container);  break;
      case 'color-fill':  buildColorFill(ex, container);  break;
      case 'count':       buildCount(ex, container);       break;
      default:
        container.innerHTML = `<p style="color:red">Unknown exercise: ${esc(ex.type)}</p>`;
    }
  }

  return {
    buildExercise,
    resetExercise,
    checkFillDialog,
    checkAlphaSort,
    resetAlphaSort,
    checkColorFill,
    checkCountInput,
  };

}());
