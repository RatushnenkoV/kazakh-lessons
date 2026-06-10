/* ===== A0 LESSON PAGE ===== */
/* Steps: intro → explanation (+ video) → vocab cards → exercise → complete */

(function () {
  'use strict';

  const DATA_URL     = 'kaz-content/grammar_full.json';
  const PROGRESS_KEY = 'a0-progress';
  const WORDS_KEY    = 'a0-words'; // spaced repetition storage
  const SEEN_KEY     = 'a0-seen';  // words that have appeared in pre-lesson cards

  // ── URL param ──────────────────────────────────────────────────────────────
  const sectionId = new URLSearchParams(location.search).get('id') || '';

  // ── State ──────────────────────────────────────────────────────────────────
  let section = null;
  let steps   = [];  // array of step descriptors
  let stepIdx = 0;

  // Word learning state for this session (legacy vocab step)
  let vocabQueue   = [];
  let vocabIndex   = 0;
  let vocabFlipped = false;

  // Pre-lesson circular vocab queue
  let vocabPreQueue   = [];
  let vocabPreFlipped = false;

  // End-of-lesson review queue
  let vocabReviewQueue   = [];
  let vocabReviewFlipped = false;
  let townWanderTimer    = null;

  // ── localStorage helpers ───────────────────────────────────────────────────
  function getProgress() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; }
    catch { return {}; }
  }
  function markDone(id) {
    const p = getProgress();
    p[id] = 'done';
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  }

  // Word store: { 'sectionId:wordIdx': { correct: N, wrong: N } }
  function getWordStore() {
    try { return JSON.parse(localStorage.getItem(WORDS_KEY)) || {}; }
    catch { return {}; }
  }
  function wordKey(sid, widx) { return `${sid}:${widx}`; }
  function recordWord(sid, widx, correct) {
    const store = getWordStore();
    const key = wordKey(sid, widx);
    const rec = store[key] || { correct: 0, wrong: 0 };
    if (correct) rec.correct++; else rec.wrong++;
    store[key] = rec;
    localStorage.setItem(WORDS_KEY, JSON.stringify(store));
  }
  function isWordLearned(sid, widx) {
    return (getWordStore()[wordKey(sid, widx)] || {}).correct >= 3;
  }

  // Seen words: set of 'sectionId:wordIdx' keys shown in pre-lesson cards
  function getSeenSet() {
    try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); }
    catch { return new Set(); }
  }
  function markSeen(sid, widx) {
    const s = getSeenSet();
    s.add(wordKey(sid, widx));
    localStorage.setItem(SEEN_KEY, JSON.stringify([...s]));
  }
  function isSeen(sid, widx) { return getSeenSet().has(wordKey(sid, widx)); }

  // Words from this section not yet shown, OR shown but never answered correctly
  function getNewWords(sec) {
    if (!sec.words || !sec.words.length) return [];
    const store = getWordStore();
    const fresh = sec.words
      .map((w, i) => ({ ...w, sid: sec.id, widx: i }))
      .filter(w => {
        if (!isSeen(w.sid, w.widx)) return true;
        return (store[wordKey(w.sid, w.widx)] || { correct: 0 }).correct === 0;
      });
    return shuffle(fresh).slice(0, 20);
  }

  // N random words the user has pressed "Знаю" on (correct >= 1), across all lessons
  function getRandomLearnedWords(n) {
    const store = getWordStore();
    const pool = [];
    for (const [key, rec] of Object.entries(store)) {
      if (rec.correct < 1) continue;
      const [sid, widxStr] = key.split(':');
      const sec = allSections.find(s => s.id === sid);
      const widx = parseInt(widxStr);
      if (sec && sec.words && sec.words[widx]) {
        pool.push({ ...sec.words[widx], sid, widx });
      }
    }
    return shuffle(pool).slice(0, n);
  }

  // ── Progress bar ───────────────────────────────────────────────────────────
  function updateProgress() {
    const bar = document.getElementById('lesson-progress-bar');
    if (bar && steps.length > 0) {
      bar.style.width = Math.round((stepIdx / steps.length) * 100) + '%';
    }
  }

  // ── Build step list ────────────────────────────────────────────────────────
  function buildSteps(sec) {
    const list = [];
    list.push({ type: 'intro' });

    // Pre-lesson vocab: new words not seen in any previous lesson
    const newWords = getNewWords(sec);
    if (newWords.length > 0) list.push({ type: 'vocab-pre', words: newWords });

    if (sec.steps && sec.steps.length > 0) {
      for (const s of sec.steps) {
        list.push({ type: 'theory', data: s });
        if (s.practice) list.push({ type: 'practice', data: s.practice });
      }
    } else {
      list.push({ type: 'explanation' });
      if (sec.relatedVideos.length)  list.push({ type: 'video' });
      if (sec.words.length)          list.push({ type: 'vocab' });
      if (sec.sentences.length >= 3) list.push({ type: 'exercise' });
    }

    // Post-lesson review: 5 random previously learned words
    const reviewWords = getRandomLearnedWords(5);
    if (reviewWords.length > 0) list.push({ type: 'vocab-review', words: reviewWords });

    list.push({ type: 'complete' });
    return list;
  }

  // ── Shuffle ────────────────────────────────────────────────────────────────
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  function goNext() {
    stepIdx++;
    if (stepIdx >= steps.length) stepIdx = steps.length - 1;
    renderStep();
    updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goPrev() {
    if (stepIdx <= 0) return;
    stepIdx--;
    renderStep();
    updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderBackBtn() {
    return `<button class="a0-back-btn" id="btn-prev">← Назад</button>`;
  }

  // ── Render dispatcher ─────────────────────────────────────────────────────
  function renderStep() {
    if (townWanderTimer) { clearInterval(townWanderTimer); townWanderTimer = null; }
    const body = document.getElementById('lesson-body');
    if (!body) return;
    const step = steps[stepIdx];
    if (!step) return;

    let html = '';
    switch (step.type) {
      case 'intro':        html = renderIntro();                                  break;
      case 'vocab-pre':    initVocabPre(step.words); html = renderVocabPreFrame(); break;
      case 'theory':       html = renderTheory(step.data);                        break;
      case 'practice':     html = renderPractice(step.data);                      break;
      case 'explanation':  html = renderExplanation();                             break;
      case 'video':        html = renderVideo();                                   break;
      case 'vocab':        initVocab(); html = renderVocabFrame();                 break;
      case 'vocab-review': initVocabReview(step.words); html = renderVocabReviewFrame(); break;
      case 'exercise':     html = renderExercise();                                break;
      case 'complete':     markDone(section.id); html = renderComplete();          break;
    }

    // Prepend back button on all steps except intro and complete
    if (stepIdx > 0 && step.type !== 'complete') {
      html = renderBackBtn() + html;
    }

    body.innerHTML = html;

    // Attach event listeners after render
    attachListeners(step.type);
    const prevBtn = document.getElementById('btn-prev');
    if (prevBtn) prevBtn.addEventListener('click', goPrev);
  }

  // ── Step: Intro ────────────────────────────────────────────────────────────
  function renderIntro() {
    const wordCount = section.words.length;
    const sentCount = section.sentences.length;
    const hasVideo  = section.relatedVideos.length > 0;

    const stats = [
      wordCount  ? `<span class="a0-step-intro-stat">📝 ${wordCount} слов</span>` : '',
      sentCount  ? `<span class="a0-step-intro-stat">💬 ${sentCount} примеров</span>` : '',
      hasVideo   ? `<span class="a0-step-intro-stat">🎬 Видео</span>` : '',
    ].filter(Boolean).join('');

    return `
      <div class="a0-step-intro">
        <div class="a0-step-intro-badge">A0 · Грамматика</div>
        <h2>${section.title}</h2>
        ${stats ? `<div class="a0-step-intro-stats">${stats}</div>` : ''}
        <button class="a0-nav-btn" id="btn-next">Начать урок →</button>
      </div>`;
  }

  // ── Step: Explanation ─────────────────────────────────────────────────────
  function renderExplanation() {
    const html = section.explanationHtml || '';

    return `
      <h3 style="font-size:1.2rem;font-weight:900;margin-bottom:20px">${section.title}</h3>
      <div class="a0-explanation kaz-content">${html || '<p>Раздел без текстового объяснения. Смотри видео.</p>'}</div>
      <button class="a0-nav-btn" id="btn-next">Продолжить →</button>`;
  }

  // ── Step: Theory (one chunk from custom steps) ───────────────────────────
  function renderTheory(stepData) {
    const stepsTotal  = section.steps.length;
    const theoryIdx   = steps.filter((s, i) => i <= stepIdx && s.type === 'theory').length;
    const badge = stepsTotal > 1
      ? `<div class="a0-theory-badge">Шаг ${theoryIdx} из ${stepsTotal}</div>` : '';
    return `
      <div class="a0-theory-wrap">
        ${badge}
        <h3 class="a0-theory-title">${stepData.title}</h3>
        <div class="a0-explanation kaz-content">${stepData.html}</div>
        <button class="a0-nav-btn" id="btn-next">К практике →</button>
      </div>`;
  }

  // ── Step: Practice (dispatcher) ──────────────────────────────────────────
  function renderPractice(p) {
    switch (p.type) {
      case 'match-pairs':  return renderMatchPairs(p);
      case 'sort-words':   return renderSortWords(p);
      case 'find-letters': return renderFindLetters(p);
      case 'pick-one':     return renderPickOne(p);
      default: return `<button class="a0-nav-btn" id="btn-next">Продолжить →</button>`;
    }
  }

  // ── Practice: match-pairs (drag left onto right, matched pairs appear holding hands) ──
  let pairsState = {};

  function renderMatchPairs(p) {
    const lefts  = p.pairs.map(pair => pair[0]);
    const rights = shuffle(p.pairs.map(pair => pair[1]));
    pairsState = { pairs: p.pairs, lefts, rights, matched: new Set(), errors: 0 };

    const leftHtml  = lefts.map((l, i) =>
      `<div class="pair-item pair-left" data-idx="${i}" style="touch-action:none;cursor:grab">${l}</div>`).join('');
    const rightHtml = rights.map(r =>
      `<div class="pair-item pair-right" data-val="${r}">${r}</div>`).join('');

    return `
      <div class="a0-practice-wrap">
        <div class="a0-practice-icon">🧩</div>
        <p class="a0-practice-instruction">${p.instruction}</p>
        <div id="matched-pairs" class="a0-matched-pairs"></div>
        <div class="a0-pairs-grid">
          <div class="a0-pairs-col" id="pairs-left">${leftHtml}</div>
          <div class="a0-pairs-col" id="pairs-right">${rightHtml}</div>
        </div>
        <div id="pairs-feedback" class="a0-practice-feedback"></div>
        <button class="a0-nav-btn" id="btn-next" style="display:none">Продолжить →</button>
      </div>`;
  }

  function attachMatchPairsListeners() {
    const body = document.getElementById('lesson-body');
    if (!body) return;
    const { pairs } = pairsState;

    let clone = null;
    let activeSrc = null;
    let startX = 0, startY = 0;

    function makeClone(src) {
      const c = src.cloneNode(true);
      const r = src.getBoundingClientRect();
      Object.assign(c.style, {
        position: 'fixed', left: r.left + 'px', top: r.top + 'px',
        width: r.width + 'px', margin: '0', pointerEvents: 'none',
        zIndex: '9999', opacity: '.9', transition: 'none',
      });
      c.classList.add('selected');
      document.body.appendChild(c);
      return c;
    }

    body.querySelectorAll('.pair-left').forEach(btn => {
      btn.addEventListener('pointerdown', e => {
        if (btn.classList.contains('correct')) return;
        activeSrc = btn;
        startX = e.clientX; startY = e.clientY;
        btn.setPointerCapture(e.pointerId);
        btn.style.opacity = '.35';
        clone = makeClone(btn);
      });

      btn.addEventListener('pointermove', e => {
        if (!clone) return;
        clone.style.transform = `translate(${e.clientX - startX}px,${e.clientY - startY}px)`;
        body.querySelectorAll('.pair-right:not(.correct)').forEach(t => {
          const r = t.getBoundingClientRect();
          t.classList.toggle('drag-over-target',
            e.clientX > r.left && e.clientX < r.right &&
            e.clientY > r.top  && e.clientY < r.bottom);
        });
      });

      btn.addEventListener('pointerup', e => {
        if (clone) { clone.remove(); clone = null; }
        if (!activeSrc) return;
        activeSrc.style.opacity = '1';

        let target = null;
        body.querySelectorAll('.pair-right:not(.correct)').forEach(t => {
          t.classList.remove('drag-over-target');
          const r = t.getBoundingClientRect();
          if (e.clientX > r.left && e.clientX < r.right &&
              e.clientY > r.top  && e.clientY < r.bottom) target = t;
        });

        if (target) {
          const leftIdx = parseInt(activeSrc.dataset.idx);
          const rightVal = target.dataset.val;
          if (rightVal === pairs[leftIdx][1]) {
            activeSrc.classList.add('correct');
            target.classList.add('correct');
            pairsState.matched.add(leftIdx);

            const el = document.createElement('div');
            el.className = 'a0-matched-pair';
            el.innerHTML = `${activeSrc.textContent} <span class="a0-handshake">🧩</span> ${target.textContent}`;
            document.getElementById('matched-pairs')?.appendChild(el);

            if (pairsState.matched.size === pairs.length) {
              const fb = document.getElementById('pairs-feedback');
              if (fb) fb.textContent = pairsState.errors === 0 ? '🎉 Отлично! Все пары верны!' : '✓ Готово!';
              document.getElementById('btn-next').style.display = '';
            }
          } else {
            pairsState.errors++;
            activeSrc.classList.add('shake'); target.classList.add('shake');
            setTimeout(() => { activeSrc?.classList.remove('shake'); target.classList.remove('shake'); }, 500);
          }
        }
        activeSrc = null;
      });

      btn.addEventListener('lostpointercapture', () => {
        if (clone) { clone.remove(); clone = null; }
        if (activeSrc) activeSrc.style.opacity = '1';
        activeSrc = null;
      });
    });
  }

  // ── Practice: sort-words (drag all cards into baskets) ───────────────────
  let sortState = {};

  function renderSortWords(p) {
    sortState = {
      items: shuffle([...p.items]),
      placed: new Set(),
      errors: 0,
      total: p.items.length,
      groups: p.groups,
    };
    return buildSortHtml(p);
  }

  function buildSortHtml(p) {
    const poolHtml = sortState.items.map((item, i) =>
      `<div class="a0-pool-card" data-idx="${i}" style="touch-action:none">
        <div class="a0-sort-word">${item.word}</div>
        ${item.hint ? `<div class="a0-sort-hint">${item.hint}</div>` : ''}
      </div>`
    ).join('');

    const basketsHtml = p.groups.map((g, gi) =>
      `<div class="a0-basket" id="basket-${gi}" data-choice="${gi}">
        <div class="a0-basket-label">${g}</div>
        <div class="a0-basket-chips" id="chips-${gi}"></div>
      </div>`
    ).join('');

    return `
      <div class="a0-practice-wrap">
        <p class="a0-practice-instruction">${p.instruction}</p>
        <div class="a0-sort-pool" id="sort-pool">${poolHtml}</div>
        <div class="a0-baskets">${basketsHtml}</div>
        <div id="sort-feedback" class="a0-practice-feedback"></div>
        <button class="a0-nav-btn" id="btn-next" style="display:none">Продолжить →</button>
      </div>`;
  }

  function attachSortWordsListeners() {
    const body = document.getElementById('lesson-body');
    if (!body) return;
    const step = steps[stepIdx];
    const p = step.data;

    const nx = document.getElementById('btn-next');
    if (nx) nx.addEventListener('click', goNext);

    body.querySelectorAll('.a0-pool-card').forEach(card => attachPoolCardDrag(card, p));
  }

  function attachPoolCardDrag(card, p) {
    let clone = null;
    let startX = 0, startY = 0;
    let hasMoved = false;

    card.addEventListener('pointerdown', e => {
      startX = e.clientX; startY = e.clientY;
      hasMoved = false;
      card.setPointerCapture(e.pointerId);
    });

    card.addEventListener('pointermove', e => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!hasMoved && Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (!hasMoved) {
        hasMoved = true;
        card.style.opacity = '.35';
        const r = card.getBoundingClientRect();
        clone = card.cloneNode(true);
        Object.assign(clone.style, {
          position: 'fixed', left: r.left + 'px', top: r.top + 'px',
          width: r.width + 'px', margin: '0', pointerEvents: 'none',
          zIndex: '9999', opacity: '0.92', transition: 'none',
          boxShadow: '0 10px 32px rgba(0,0,0,.22)',
        });
        document.body.appendChild(clone);
      }
      const rot = Math.max(-14, Math.min(14, (e.clientX - startX) * 0.04));
      clone.style.transform = `translate(${e.clientX - startX}px,${e.clientY - startY}px) rotate(${rot}deg) scale(1.06)`;
      const body2 = document.getElementById('lesson-body');
      if (body2) body2.querySelectorAll('.a0-basket').forEach(b => {
        const r2 = b.getBoundingClientRect();
        b.classList.toggle('drag-over',
          e.clientX > r2.left && e.clientX < r2.right &&
          e.clientY > r2.top  && e.clientY < r2.bottom);
      });
    });

    function settle(e) {
      if (clone) { clone.remove(); clone = null; }
      card.style.opacity = '1';
      if (!hasMoved) return;
      hasMoved = false;

      const body2 = document.getElementById('lesson-body');
      let chosen = null;
      if (body2) body2.querySelectorAll('.a0-basket').forEach(b => {
        b.classList.remove('drag-over');
        const r = b.getBoundingClientRect();
        if (e.clientX > r.left && e.clientX < r.right &&
            e.clientY > r.top  && e.clientY < r.bottom) chosen = b;
      });

      if (!chosen) return;

      const itemIdx = parseInt(card.dataset.idx);
      const item = sortState.items[itemIdx];
      const correct = parseInt(chosen.dataset.choice) === item.correct;
      const fb = document.getElementById('sort-feedback');

      if (correct) {
        sortState.placed.add(itemIdx);
        const chipsEl = document.getElementById(`chips-${item.correct}`);
        if (chipsEl) {
          const chip = document.createElement('div');
          chip.className = 'a0-basket-chip';
          chip.textContent = item.word;
          if (item.hint) chip.title = item.hint;
          chipsEl.appendChild(chip);
        }
        card.style.transition = 'transform .18s ease, opacity .22s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.4)';
        setTimeout(() => card.remove(), 250);

        chosen.classList.add('basket-success');
        setTimeout(() => chosen.classList.remove('basket-success'), 500);

        if (sortState.placed.size === sortState.total) {
          if (fb) {
            fb.textContent = sortState.errors === 0 ? '🎉 Всё правильно!' : '✓ Разобрано!';
            fb.className = 'a0-practice-feedback correct';
          }
          const nxBtn = document.getElementById('btn-next');
          if (nxBtn) nxBtn.style.display = '';
        } else {
          if (fb) {
            fb.textContent = '✓ Верно!';
            fb.className = 'a0-practice-feedback correct';
            setTimeout(() => { if (fb && fb.textContent === '✓ Верно!') fb.textContent = ''; }, 700);
          }
        }
      } else {
        sortState.errors++;
        card.classList.add('shake');
        chosen.classList.add('basket-error');
        setTimeout(() => {
          card.classList.remove('shake');
          chosen.classList.remove('basket-error');
        }, 500);
        if (fb) {
          fb.textContent = `✗ Это «${p.groups[item.correct]}»`;
          fb.className = 'a0-practice-feedback wrong';
          setTimeout(() => { if (fb && fb.textContent.startsWith('✗')) fb.textContent = ''; }, 1100);
        }
      }
    }

    card.addEventListener('pointerup', settle);
    card.addEventListener('lostpointercapture', () => {
      if (clone) { clone.remove(); clone = null; }
      card.style.opacity = '1';
      hasMoved = false;
    });
  }

  // ── Practice: pick-one ────────────────────────────────────────────────────
  let pickState = {};

  function renderPickOne(p) {
    pickState = { questions: shuffle([...p.questions]), idx: 0, score: 0, answered: false };
    return renderPickCard(p);
  }

  function renderPickCard(p) {
    if (pickState.idx >= pickState.questions.length) {
      const pct = Math.round(pickState.score / pickState.questions.length * 100);
      return `
        <div class="a0-practice-wrap" style="text-align:center">
          <div style="font-size:3rem;margin-bottom:12px">${pct >= 75 ? '🎉' : '👍'}</div>
          <div class="a0-practice-result">${pickState.score} из ${pickState.questions.length} верно</div>
          <button class="a0-nav-btn" id="btn-next">Продолжить →</button>
        </div>`;
    }

    const q = pickState.questions[pickState.idx];
    const num = `${pickState.idx + 1} / ${pickState.questions.length}`;
    const optHtml = q.options.map((o, i) =>
      `<button class="a0-pick-btn" data-idx="${i}">${o}</button>`).join('');

    return `
      <div class="a0-practice-wrap">
        <div class="a0-practice-icon">❓</div>
        <p class="a0-practice-instruction">${p.instruction}</p>
        <div class="a0-sort-progress">${num}</div>
        <div class="a0-pick-prompt">${q.prompt}</div>
        <div class="a0-pick-options">${optHtml}</div>
        <div id="pick-feedback" class="a0-practice-feedback"></div>
      </div>`;
  }

  function attachPickOneListeners() {
    const body = document.getElementById('lesson-body');
    if (!body) return;
    const step = steps[stepIdx];
    const p = step.data;

    body.querySelectorAll('.a0-pick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (pickState.answered) return;
        pickState.answered = true;

        const chosen  = parseInt(btn.dataset.idx);
        const q       = pickState.questions[pickState.idx];
        const correct = chosen === q.correct;
        if (correct) pickState.score++;

        body.querySelectorAll('.a0-pick-btn').forEach((b, i) => {
          b.disabled = true;
          if (i === q.correct) b.classList.add('correct');
          else if (i === chosen) b.classList.add('wrong');
        });

        const fb = document.getElementById('pick-feedback');
        if (fb) {
          fb.textContent = correct ? '✓ Верно!' : `✗ Правильно: ${q.options[q.correct]}`;
          fb.className = 'a0-practice-feedback ' + (correct ? 'correct' : 'wrong');
        }

        setTimeout(() => {
          pickState.idx++;
          pickState.answered = false;
          body.innerHTML = renderPickCard(p);
          attachPickOneListeners();
        }, 1100);
      });
    });

    const nx = document.getElementById('btn-next');
    if (nx) nx.addEventListener('click', goNext);
  }

  // ── Practice: find-letters (Town Letter Hunt) ────────────────────────────
  let findState = {};

  function renderFindLetters(p) {
    const letters = shuffle([...p.letters]);
    const target  = p.target || letters.filter(l => l.kazakh).length;
    findState = { letters, found: 0, target, errors: 0 };

    const hatColors  = ['#e74c3c','#e67e22','#f1c40f','#27ae60','#2980b9','#8e44ad','#16a085','#c0392b','#d35400','#1abc9c','#2c3e50','#e91e63','#6c5ce7','#fd79a8','#00b894','#e17055','#0984e3','#a29bfe'];
    const bodyColors = ['#ffe8e8','#ffecd2','#fffde7','#e8f8f0','#ebf5fb','#f5eef8','#e8f8f5','#fdedec','#fef5e7','#e8f8f5','#eaecee','#fce4ec','#ede7f6','#fce4ec','#e0f7fa','#fbe9e7','#e3f2fd','#ede7f6'];
    const bdColors   = ['#c0392b','#d35400','#d4ac0d','#1e8449','#1a5276','#6c3483','#0e6655','#922b21','#a04000','#0f6b55','#212f3d','#b71c1c','#4527a0','#ad1457','#00838f','#bf360c','#0d47a1','#4a148c'];

    const charsHtml = letters.map((l, i) => {
      const x = (5 + Math.random() * 60).toFixed(1);
      const y = (6 + Math.random() * 38).toFixed(1);
      return `<button class="lchar walking" id="lc-${i}" data-kazakh="${l.kazakh}"
        style="left:${x}%;top:${y}%;--hc:${hatColors[i % hatColors.length]};--bc:${bodyColors[i % bodyColors.length]};--bdc:${bdColors[i % bdColors.length]}"
        aria-label="${l.char}">
        <div class="lchar-hat"></div>
        <div class="lchar-body">${l.char}</div>
        <div class="lchar-feet"><div class="lchar-leg"></div><div class="lchar-leg"></div></div>
      </button>`;
    }).join('');

    const busWinsHtml = Array.from({length: target}, (_, i) =>
      `<div class="town-bus-win" id="bwin-${i}"></div>`
    ).join('');

    const bldgs = `
      <div class="town-bldg" style="left:13%;width:42px;height:78px;background:#d4a0a0">
        <div class="town-bldg-win" style="top:14px;left:6px"></div>
        <div class="town-bldg-win" style="top:14px;left:22px"></div>
        <div class="town-bldg-win" style="top:34px;left:6px"></div>
        <div class="town-bldg-win" style="top:34px;left:22px"></div>
      </div>
      <div class="town-bldg" style="left:34%;width:32px;height:55px;background:#a0b8d4">
        <div class="town-bldg-win" style="top:12px;left:5px"></div>
        <div class="town-bldg-win" style="top:12px;left:18px"></div>
        <div class="town-bldg-win" style="top:30px;left:11px"></div>
      </div>
      <div class="town-bldg" style="left:54%;width:48px;height:92px;background:#b8d4a0">
        <div class="town-bldg-win" style="top:12px;left:6px"></div>
        <div class="town-bldg-win" style="top:12px;left:24px"></div>
        <div class="town-bldg-win" style="top:30px;left:6px"></div>
        <div class="town-bldg-win" style="top:30px;left:24px"></div>
        <div class="town-bldg-win" style="top:48px;left:14px"></div>
      </div>`;

    return `
      <div class="a0-practice-wrap">
        <div class="a0-practice-icon">🏙️</div>
        <p class="a0-practice-instruction">${p.instruction}</p>
        <div class="town-game" id="town-game">
          <div class="town-sky"></div>
          <div class="town-cloud" style="top:7%;left:6%;width:52px"></div>
          <div class="town-cloud" style="top:14%;left:46%;width:38px;opacity:.72"></div>
          <div class="town-ground"></div>
          ${bldgs}
          ${charsHtml}
          <div class="town-bus-wrap" id="town-bus-wrap">
            <div class="town-bus">
              <div class="town-bus-sign">🌴 Каникулы!</div>
              <div class="town-bus-wins" id="town-bus-wins">${busWinsHtml}</div>
            </div>
            <div class="town-bus-wh l"></div>
            <div class="town-bus-wh r"></div>
          </div>
          <div class="town-counter" id="town-counter">🎯 0 / ${target}</div>
        </div>
        <div id="find-feedback" class="a0-practice-feedback"></div>
        <button class="a0-nav-btn" id="btn-next" style="display:none">Продолжить →</button>
      </div>`;
  }

  function attachFindLettersListeners() {
    const game = document.getElementById('town-game');
    if (!game) return;
    const { target } = findState;

    function wander() {
      game.querySelectorAll('.lchar:not(.catching)').forEach(el => {
        if (Math.random() < 0.55) {
          el.style.left = (5  + Math.random() * 60).toFixed(1) + '%';
          el.style.top  = (6  + Math.random() * 38).toFixed(1) + '%';
        }
      });
    }
    wander();
    townWanderTimer = setInterval(wander, 2200);

    game.querySelectorAll('.lchar').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('catching')) return;
        const isKazakh = btn.dataset.kazakh === 'true';

        if (isKazakh) {
          findState.found++;
          const slot = findState.found - 1;
          const char = btn.querySelector('.lchar-body').textContent;

          const gr = game.getBoundingClientRect();
          const br = document.getElementById('town-bus-wrap').getBoundingClientRect();
          btn.classList.add('catching');
          btn.style.left = ((br.left + br.width  * .5 - gr.left) / gr.width  * 100).toFixed(1) + '%';
          btn.style.top  = ((br.top  + br.height * .5 - gr.top)  / gr.height * 100).toFixed(1) + '%';

          setTimeout(() => {
            const win = document.getElementById(`bwin-${slot}`);
            if (win) { win.textContent = char; win.classList.add('filled'); }
            const ctr = document.getElementById('town-counter');
            if (ctr) ctr.textContent = `🎯 ${findState.found} / ${target}`;

            if (findState.found >= target) {
              clearInterval(townWanderTimer); townWanderTimer = null;
              setTimeout(() => {
                document.getElementById('town-bus-wrap').classList.add('departing');
                setTimeout(() => {
                  const fb = document.getElementById('find-feedback');
                  if (fb) fb.textContent = findState.errors === 0
                    ? '🎉 Все казахские буквы уехали в отпуск!'
                    : '✓ Готово! Автобус уехал!';
                  document.getElementById('btn-next').style.display = '';
                }, 1400);
              }, 500);
            }
          }, 580);

        } else {
          findState.errors++;
          btn.classList.add('wrong');
          setTimeout(() => btn.classList.remove('wrong'), 420);
        }
      });
    });
  }

  // ── Vocab: pre-lesson circular loop ──────────────────────────────────────
  function initVocabPre(words) {
    words.forEach(w => markSeen(w.sid, w.widx));
    const pairs = words.flatMap(w => [{ ...w, dir: 'kaz' }, { ...w, dir: 'ru' }]);
    vocabPreQueue = shuffle(pairs);
    vocabPreFlipped = false;
  }

  function renderVocabPreFrame() {
    return `
      <div class="a0-vocab-section-header">
        <h3>Слова этого урока</h3>
        <p>Учи по кругу, пока все не станут «Знаю»</p>
      </div>
      <div id="vocab-pre-area">${renderVocabPreCard()}</div>`;
  }

  function renderVocabPreCard() {
    if (vocabPreQueue.length === 0) {
      return `<div style="text-align:center;padding:32px 0">
        <div style="font-size:3rem;margin-bottom:12px">🎉</div>
        <div style="font-size:1.1rem;font-weight:800;margin-bottom:20px">Все слова выучены!</div>
        <button class="a0-nav-btn" id="btn-next">Начать урок →</button>
      </div>`;
    }
    const item = vocabPreQueue[0];
    const front = item.dir === 'kaz' ? item.kaz : item.ru;
    const back  = item.dir === 'kaz' ? item.ru  : item.kaz;
    const frontLang = item.dir === 'kaz' ? '🇰🇿 Казахский' : '🇷🇺 Русский';
    const backLang  = item.dir === 'kaz' ? '🇷🇺 Русский'   : '🇰🇿 Казахский';
    return `
      <div style="text-align:center;margin-bottom:8px">
        <span class="a0-sort-progress">осталось ${vocabPreQueue.length}</span>
      </div>
      <div class="fc-drag-wrap" id="vpc-drag" style="touch-action:none">
        <div class="fc-swipe-label fc-swipe-know">ЗНАЮ ✓</div>
        <div class="fc-swipe-label fc-swipe-nope">✗ НЕ ЗНАЮ</div>
        <div class="fc-card-wrap">
          <div class="fc-card" id="vpc">
            <div class="fc-card-face fc-card-front">
              <div class="fc-card-lang">${frontLang}</div>
              <div class="fc-card-text">${front}</div>
              <div class="fc-flip-hint">Тап — перевернуть</div>
            </div>
            <div class="fc-card-face fc-card-back">
              <div class="fc-card-lang">${backLang}</div>
              <div class="fc-card-text">${back}</div>
              <div class="fc-flip-hint">Тап — назад</div>
            </div>
          </div>
        </div>
      </div>
      <div class="fc-swipe-hint-row" style="margin-bottom:12px">
        <span class="fc-hint-nope">← Не знаю</span>
        <span class="fc-hint-know">Знаю →</span>
      </div>
      <div id="vpc-actions" style="display:none;gap:10px">
        <button class="a0-nav-btn" id="btn-pre-wrong" style="background:var(--error);flex:1;margin-top:0">✗ Не знаю</button>
        <button class="a0-nav-btn" id="btn-pre-know"  style="background:var(--success);flex:1;margin-top:0">✓ Знаю!</button>
      </div>`;
  }

  function attachVocabPreListeners() {
    const area     = document.getElementById('vocab-pre-area');
    const dragWrap = document.getElementById('vpc-drag');
    const card     = document.getElementById('vpc');
    const btnNext  = document.getElementById('btn-next');

    if (btnNext) btnNext.addEventListener('click', goNext);
    if (!dragWrap || !card) return;

    const THRESHOLD = 80;
    let startX = 0, currentX = 0, active = false, hasMoved = false;
    const knowLabel = dragWrap.querySelector('.fc-swipe-know');
    const nopeLabel = dragWrap.querySelector('.fc-swipe-nope');

    function preKnow() {
      const item = vocabPreQueue.shift();
      if (item) recordWord(item.sid, item.widx, true);
      vocabPreFlipped = false;
      if (area) { area.innerHTML = renderVocabPreCard(); attachVocabPreListeners(); }
    }

    function preWrong() {
      const item = vocabPreQueue.shift();
      if (item) {
        vocabPreQueue.push({ ...item });
        recordWord(item.sid, item.widx, false);
      }
      vocabPreFlipped = false;
      if (area) { area.innerHTML = renderVocabPreCard(); attachVocabPreListeners(); }
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
        dragWrap.style.transform = '';
        vocabPreFlipped = !vocabPreFlipped;
        card.classList.toggle('flipped', vocabPreFlipped);
        const actions = document.getElementById('vpc-actions');
        if (actions) actions.style.display = vocabPreFlipped ? 'flex' : 'none';
        return;
      }

      if (currentX > THRESHOLD) {
        dragWrap.style.transition = 'transform .35s ease-in';
        dragWrap.style.transform = `translateX(${window.innerWidth}px) rotate(25deg)`;
        if (knowLabel) knowLabel.style.opacity = 1;
        setTimeout(preKnow, 350);
      } else if (currentX < -THRESHOLD) {
        dragWrap.style.transition = 'transform .35s ease-in';
        dragWrap.style.transform = `translateX(-${window.innerWidth}px) rotate(-25deg)`;
        if (nopeLabel) nopeLabel.style.opacity = 1;
        setTimeout(preWrong, 350);
      } else {
        dragWrap.style.transition = 'transform .3s cubic-bezier(.25,.8,.25,1)';
        dragWrap.style.transform = '';
        if (knowLabel) knowLabel.style.opacity = 0;
        if (nopeLabel) nopeLabel.style.opacity = 0;
      }
    });

    dragWrap.addEventListener('lostpointercapture', () => { active = false; });

    const btnKnow  = document.getElementById('btn-pre-know');
    const btnWrong = document.getElementById('btn-pre-wrong');
    if (btnKnow)  btnKnow.addEventListener('click', preKnow);
    if (btnWrong) btnWrong.addEventListener('click', preWrong);
  }

  // ── Vocab: end-of-lesson review (5 learned words, one pass) ──────────────
  function initVocabReview(words) {
    vocabReviewQueue = words.map(w => ({ ...w, dir: Math.random() < .5 ? 'kaz' : 'ru' }));
    vocabReviewFlipped = false;
  }

  function renderVocabReviewFrame() {
    return `
      <div class="a0-vocab-section-header">
        <h3>Закрепление</h3>
        <p>Вспомни слова из прошлых уроков</p>
      </div>
      <div id="vocab-review-area">${renderVocabReviewCard()}</div>`;
  }

  function renderVocabReviewCard() {
    if (vocabReviewQueue.length === 0) {
      return `<div style="text-align:center;padding:32px 0">
        <div style="font-size:3rem;margin-bottom:12px">✅</div>
        <div style="font-size:1.1rem;font-weight:800;margin-bottom:20px">Отлично!</div>
        <button class="a0-nav-btn" id="btn-next">Завершить урок →</button>
      </div>`;
    }
    const item = vocabReviewQueue[0];
    const front = item.dir === 'kaz' ? item.kaz : item.ru;
    const back  = item.dir === 'kaz' ? item.ru  : item.kaz;
    const frontLang = item.dir === 'kaz' ? '🇰🇿 Казахский' : '🇷🇺 Русский';
    const backLang  = item.dir === 'kaz' ? '🇷🇺 Русский'   : '🇰🇿 Казахский';
    return `
      <div style="text-align:center;margin-bottom:8px">
        <span class="a0-sort-progress">осталось ${vocabReviewQueue.length}</span>
      </div>
      <div class="fc-drag-wrap" id="vrc-drag" style="touch-action:none">
        <div class="fc-swipe-label fc-swipe-know">ЗНАЮ ✓</div>
        <div class="fc-swipe-label fc-swipe-nope">✗ НЕ ЗНАЮ</div>
        <div class="fc-card-wrap">
          <div class="fc-card" id="vrc">
            <div class="fc-card-face fc-card-front">
              <div class="fc-card-lang">${frontLang}</div>
              <div class="fc-card-text">${front}</div>
              <div class="fc-flip-hint">Тап — перевернуть</div>
            </div>
            <div class="fc-card-face fc-card-back">
              <div class="fc-card-lang">${backLang}</div>
              <div class="fc-card-text">${back}</div>
              <div class="fc-flip-hint">Тап — назад</div>
            </div>
          </div>
        </div>
      </div>
      <div class="fc-swipe-hint-row" style="margin-bottom:12px">
        <span class="fc-hint-nope">← Не знаю</span>
        <span class="fc-hint-know">Знаю →</span>
      </div>
      <div id="vrc-actions" style="display:none;gap:10px">
        <button class="a0-nav-btn" id="btn-rev-wrong" style="background:var(--error);flex:1;margin-top:0">✗ Не знаю</button>
        <button class="a0-nav-btn" id="btn-rev-know"  style="background:var(--success);flex:1;margin-top:0">✓ Знаю!</button>
      </div>`;
  }

  function attachVocabReviewListeners() {
    const area     = document.getElementById('vocab-review-area');
    const dragWrap = document.getElementById('vrc-drag');
    const card     = document.getElementById('vrc');
    const btnNext  = document.getElementById('btn-next');

    if (btnNext) btnNext.addEventListener('click', goNext);
    if (!dragWrap || !card) return;

    const THRESHOLD = 80;
    let startX = 0, currentX = 0, active = false, hasMoved = false;
    const knowLabel = dragWrap.querySelector('.fc-swipe-know');
    const nopeLabel = dragWrap.querySelector('.fc-swipe-nope');

    function reviewKnow() {
      const item = vocabReviewQueue.shift();
      if (item) recordWord(item.sid, item.widx, true);
      vocabReviewFlipped = false;
      if (area) { area.innerHTML = renderVocabReviewCard(); attachVocabReviewListeners(); }
    }

    function reviewWrong() {
      const item = vocabReviewQueue.shift();
      if (item) recordWord(item.sid, item.widx, false);
      vocabReviewFlipped = false;
      if (area) { area.innerHTML = renderVocabReviewCard(); attachVocabReviewListeners(); }
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
        dragWrap.style.transform = '';
        vocabReviewFlipped = !vocabReviewFlipped;
        card.classList.toggle('flipped', vocabReviewFlipped);
        const actions = document.getElementById('vrc-actions');
        if (actions) actions.style.display = vocabReviewFlipped ? 'flex' : 'none';
        return;
      }

      if (currentX > THRESHOLD) {
        dragWrap.style.transition = 'transform .35s ease-in';
        dragWrap.style.transform = `translateX(${window.innerWidth}px) rotate(25deg)`;
        if (knowLabel) knowLabel.style.opacity = 1;
        setTimeout(reviewKnow, 350);
      } else if (currentX < -THRESHOLD) {
        dragWrap.style.transition = 'transform .35s ease-in';
        dragWrap.style.transform = `translateX(-${window.innerWidth}px) rotate(-25deg)`;
        if (nopeLabel) nopeLabel.style.opacity = 1;
        setTimeout(reviewWrong, 350);
      } else {
        dragWrap.style.transition = 'transform .3s cubic-bezier(.25,.8,.25,1)';
        dragWrap.style.transform = '';
        if (knowLabel) knowLabel.style.opacity = 0;
        if (nopeLabel) nopeLabel.style.opacity = 0;
      }
    });

    dragWrap.addEventListener('lostpointercapture', () => { active = false; });

    const btnKnow  = document.getElementById('btn-rev-know');
    const btnWrong = document.getElementById('btn-rev-wrong');
    if (btnKnow)  btnKnow.addEventListener('click', reviewKnow);
    if (btnWrong) btnWrong.addEventListener('click', reviewWrong);
  }

  // ── Audio playback ────────────────────────────────────────────────────────
  function attachAudioListeners() {
    const body = document.getElementById('lesson-body');
    if (!body) return;
    let currentAudio = null;
    body.querySelectorAll('.play-audio').forEach(btn => {
      btn.addEventListener('click', () => {
        const src = btn.dataset.src;
        if (!src) return;
        if (currentAudio) { currentAudio.pause(); currentAudio = null; }
        const audio = new Audio(src);
        currentAudio = audio;
        audio.play().catch(() => {});
      });
    });
  }

  // ── Step: Video ───────────────────────────────────────────────────────────
  function renderVideo() {
    const videoId = section.relatedVideos[0];
    const ytId = videoId.replace('videosab', '');
    // We stored the YouTube URL in videocourse; simplest: use the videoId to map
    // For now, show a link (we don't have the youtubeUrl in grammar_parsed, we have the ID)
    return `
      <h3 style="font-size:1.1rem;font-weight:900;margin-bottom:16px">Видео к уроку</h3>
      <div class="a0-explanation" style="text-align:center;padding:24px">
        <p style="margin-bottom:16px">Видеоурок по теме «${section.title}»</p>
        <a href="#" class="a0-nav-btn" style="display:inline-block;width:auto;padding:12px 28px"
           id="video-link">Смотреть видео ↗</a>
      </div>
      <button class="a0-nav-btn" style="margin-top:12px" id="btn-next">Продолжить →</button>`;
  }

  // ── Step: Vocabulary flashcards ────────────────────────────────────────────
  function initVocab() {
    // Mix kaz→ru and ru→kaz, prioritize words not yet learned
    const store = getWordStore();
    const wordsWithMeta = section.words.map((w, i) => ({
      word: w, idx: i,
      learned: isWordLearned(section.id, i),
      wrong: (store[wordKey(section.id, i)] || {}).wrong || 0,
    }));

    // Sort: not learned first, then by wrong count desc, then shuffle within groups
    const notLearned = shuffle(wordsWithMeta.filter(w => !w.learned));
    const learned    = shuffle(wordsWithMeta.filter(w => w.learned));
    const ordered = [...notLearned, ...learned].slice(0, Math.max(10, notLearned.length));

    // Build queue: alternate directions
    vocabQueue = [];
    for (const w of ordered) {
      const dir = Math.random() < .5 ? 'kaz' : 'ru';
      vocabQueue.push({ ...w, dir });
    }
    // Shuffle queue
    vocabQueue = shuffle(vocabQueue);
    vocabIndex = 0;
    vocabFlipped = false;
  }

  function renderVocabFrame() {
    return `
      <div class="a0-vocab-header">
        <h3>Слова урока</h3>
        <p>Нажми на карточку, чтобы увидеть перевод</p>
      </div>
      <div id="vocab-area">${renderVocabCard()}</div>`;
  }

  function renderVocabCard() {
    if (vocabIndex >= vocabQueue.length) {
      return `
        <div style="text-align:center;padding:32px 0">
          <div style="font-size:3rem;margin-bottom:12px">🎉</div>
          <div style="font-size:1.1rem;font-weight:800;margin-bottom:20px">Все слова пройдены!</div>
          <button class="a0-nav-btn" id="btn-next">Продолжить →</button>
        </div>`;
    }

    const item = vocabQueue[vocabIndex];
    const w = item.word;
    const dir = item.dir;
    const front = dir === 'kaz' ? w.kaz : w.ru;
    const back  = dir === 'kaz' ? w.ru  : w.kaz;
    const dirLabel = dir === 'kaz' ? 'Казахский → Русский' : 'Русский → Казахский';
    const progress = `${vocabIndex + 1} / ${vocabQueue.length}`;
    const learnedCount = vocabQueue.slice(0, vocabIndex).filter((_, i) =>
      isWordLearned(section.id, vocabQueue[i]?.idx)
    ).length;

    return `
      <div style="text-align:center;margin-bottom:8px">
        <span style="font-size:.8rem;font-weight:700;color:var(--text-muted)">${dirLabel} · ${progress}</span>
      </div>
      <div class="fc-progress-bar-wrap" style="margin-bottom:20px">
        <div class="fc-progress-bar" style="width:${Math.round(vocabIndex/vocabQueue.length*100)}%"></div>
      </div>
      <div class="vocab-card" id="vocab-card" style="
        background:var(--bg-card);border:2px solid var(--border);border-radius:var(--r-xl);
        padding:40px 28px;text-align:center;cursor:pointer;min-height:160px;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        transition:var(--transition);box-shadow:var(--shadow-sm);margin-bottom:16px;
        user-select:none;
      ">
        <div id="vocab-front" style="font-size:1.6rem;font-weight:900;color:var(--text)">${front}</div>
        <div id="vocab-back" style="font-size:1.2rem;color:var(--text-muted);margin-top:12px;display:none">${back}</div>
        <div id="vocab-tap-hint" style="font-size:.8rem;color:var(--text-light);margin-top:16px;font-weight:600">Нажми чтобы перевернуть</div>
      </div>
      <div id="vocab-actions" style="display:none;gap:10px;justify-content:center">
        <button class="a0-nav-btn" id="btn-wrong" style="background:var(--error);flex:1;margin-top:0">Не знаю</button>
        <button class="a0-nav-btn" id="btn-correct" style="background:var(--success);flex:1;margin-top:0">Знаю!</button>
      </div>`;
  }

  function flipVocabCard() {
    if (vocabFlipped) return;
    vocabFlipped = true;
    const back    = document.getElementById('vocab-back');
    const hint    = document.getElementById('vocab-tap-hint');
    const actions = document.getElementById('vocab-actions');
    if (back)    back.style.display = 'block';
    if (hint)    hint.style.display = 'none';
    if (actions) actions.style.display = 'flex';
  }

  function vocabAnswer(correct) {
    const item = vocabQueue[vocabIndex];
    recordWord(section.id, item.idx, correct);

    // If wrong, push back into queue (with opposite direction) for retry
    if (!correct) {
      vocabQueue.push({ ...item, dir: item.dir === 'kaz' ? 'ru' : 'kaz' });
    }

    vocabIndex++;
    vocabFlipped = false;
    const area = document.getElementById('vocab-area');
    if (area) { area.innerHTML = renderVocabCard(); attachVocabListeners(); }
  }

  function attachVocabListeners() {
    const card = document.getElementById('vocab-card');
    if (card) card.addEventListener('click', flipVocabCard);
    const btnWrong   = document.getElementById('btn-wrong');
    const btnCorrect = document.getElementById('btn-correct');
    if (btnWrong)   btnWrong.addEventListener('click',   () => vocabAnswer(false));
    if (btnCorrect) btnCorrect.addEventListener('click', () => vocabAnswer(true));
    const btnNext = document.getElementById('btn-next');
    if (btnNext) btnNext.addEventListener('click', goNext);
  }

  // ── Step: Exercise (sentence ordering) ───────────────────────────────────
  let exerciseSentences = [];
  let exIdx = 0;
  let exScore = 0;
  let exTotal = 0;
  let placedFragments = [];

  function renderExercise() {
    // Pick up to 5 random sentences
    exerciseSentences = shuffle(section.sentences).slice(0, 5);
    exIdx = 0; exScore = 0; exTotal = exerciseSentences.length;
    return renderExerciseItem();
  }

  function renderExerciseItem() {
    if (exIdx >= exerciseSentences.length) {
      return `
        <div style="text-align:center;padding:32px 0">
          <div style="font-size:3rem;margin-bottom:12px">${exScore === exTotal ? '🏆' : '👍'}</div>
          <div style="font-size:1.2rem;font-weight:900;margin-bottom:8px">
            ${exScore} из ${exTotal} правильно
          </div>
          <div style="font-size:.95rem;color:var(--text-muted);margin-bottom:28px">
            ${exScore === exTotal ? 'Отлично!' : 'Хорошая работа!'}
          </div>
          <button class="a0-nav-btn" id="btn-next">Завершить урок →</button>
        </div>`;
    }

    const sent = exerciseSentences[exIdx];
    const words = sent.kaz.split(' ');
    const shuffled = shuffle(words);
    placedFragments = [];

    const frags = shuffled.map((w, i) =>
      `<button class="a0-frag" data-word="${escHtml(w)}" data-idx="${i}">${escHtml(w)}</button>`
    ).join('');

    return `
      <div class="a0-exercise">
        <div class="a0-exercise-head">
          <h4>Составь предложение · ${exIdx + 1} / ${exTotal}</h4>
          <p>«${escHtml(sent.ru)}»</p>
        </div>
        <div class="a0-exercise-body">
          <div class="a0-sent-slot" id="sent-slot"></div>
          <div class="a0-sent-fragments" id="sent-frags">${frags}</div>
          <div class="a0-exercise-feedback" id="ex-feedback"></div>
          <button class="a0-nav-btn" id="btn-check" disabled>Проверить</button>
        </div>
      </div>`;
  }

  function attachExerciseListeners() {
    const fragsEl = document.getElementById('sent-frags');
    const slotEl  = document.getElementById('sent-slot');
    const checkBtn = document.getElementById('btn-check');
    if (!fragsEl || !slotEl || !checkBtn) return;

    // Click on frag → move to slot
    fragsEl.addEventListener('click', e => {
      const frag = e.target.closest('.a0-frag');
      if (!frag || frag.classList.contains('placed')) return;
      frag.classList.add('placed');
      placedFragments.push(frag.dataset.word);
      // Clone to slot
      const clone = document.createElement('button');
      clone.className = 'a0-frag placed';
      clone.textContent = frag.dataset.word;
      clone.dataset.word = frag.dataset.word;
      clone.addEventListener('click', () => {
        // Remove from slot on click
        const widx = placedFragments.lastIndexOf(clone.dataset.word);
        if (widx > -1) placedFragments.splice(widx, 1);
        clone.remove();
        frag.classList.remove('placed');
        updateCheckBtn();
      });
      slotEl.appendChild(clone);
      updateCheckBtn();
    });

    function updateCheckBtn() {
      const allWords = fragsEl.querySelectorAll('.a0-frag');
      const allPlaced = [...allWords].every(f => f.classList.contains('placed'));
      checkBtn.disabled = !allPlaced && placedFragments.length === 0;
      checkBtn.disabled = placedFragments.length === 0;
    }

    checkBtn.addEventListener('click', () => {
      if (checkBtn.dataset.state === 'next') { nextExItem(); return; }

      const sent = exerciseSentences[exIdx];
      const correct = placedFragments.join(' ') === sent.kaz;
      const feedback = document.getElementById('ex-feedback');

      if (feedback) {
        feedback.className = 'a0-exercise-feedback ' + (correct ? 'correct' : 'wrong');
        feedback.textContent = correct
          ? '✓ Правильно!'
          : `✗ Правильный ответ: ${sent.kaz}`;
      }

      // Color the slot fragments
      slotEl.querySelectorAll('.a0-frag').forEach((f, i) => {
        const correctWord = sent.kaz.split(' ')[i];
        f.classList.add(f.dataset.word === correctWord ? 'correct' : 'wrong');
      });

      if (correct) exScore++;

      checkBtn.textContent = 'Следующее →';
      checkBtn.dataset.state = 'next';
      checkBtn.disabled = false;

      // Disable frag clicking
      slotEl.querySelectorAll('.a0-frag').forEach(f => f.style.pointerEvents = 'none');
    });
  }

  function nextExItem() {
    exIdx++;
    const body = document.getElementById('lesson-body');
    if (body) { body.innerHTML = renderExerciseItem(); attachExerciseListeners(); }
  }

  // ── Step: Complete ────────────────────────────────────────────────────────
  function renderComplete() {
    return `
      <div class="a0-complete">
        <div class="a0-complete-icon">🎉</div>
        <h2>Урок завершён!</h2>
        <p>Раздел «${section.title}» пройден</p>
        <div class="a0-complete-actions">
          <a href="index.html" class="a0-nav-btn">← К списку уроков</a>
          ${getNextSectionHref() ? `<a href="${getNextSectionHref()}" class="a0-nav-btn primary">Следующий урок →</a>` : ''}
        </div>
      </div>`;
  }

  let allSections = [];

  function getNextSectionHref() {
    const idx = allSections.findIndex(s => s.id === section.id);
    if (idx < 0 || idx >= allSections.length - 1) return '';
    const next = allSections[idx + 1];
    return `lesson.html?id=${next.id}`;
  }

  // ── Attach listeners by step type ─────────────────────────────────────────
  function attachListeners(type) {
    const btn = document.getElementById('btn-next');
    if (btn && type !== 'vocab' && type !== 'vocab-pre' && type !== 'vocab-review') {
      btn.addEventListener('click', goNext);
    }

    if (type === 'vocab')        attachVocabListeners();
    if (type === 'vocab-pre')    attachVocabPreListeners();
    if (type === 'vocab-review') attachVocabReviewListeners();
    if (type === 'exercise')     attachExerciseListeners();
    if (type === 'explanation')  attachAudioListeners();
    if (type === 'theory')       attachAudioListeners();
    if (type === 'practice') {
      const p = steps[stepIdx].data;
      if (p.type === 'match-pairs')  attachMatchPairsListeners();
      if (p.type === 'sort-words')   attachSortWordsListeners();
      if (p.type === 'pick-one')     attachPickOneListeners();
      if (p.type === 'find-letters') attachFindLettersListeners();
    }

    if (type === 'video') loadVideoUrl();
  }

  async function loadVideoUrl() {
    try {
      const resp = await fetch('kaz-content/videocourse.json');
      const data = await resp.json();
      const videoId = section.relatedVideos[0];
      const lesson = data.lessons.find(l => l.id === videoId);
      if (lesson) {
        const link = document.getElementById('video-link');
        if (link) { link.href = lesson.youtubeUrl; link.target = '_blank'; }
        // Try to embed YouTube
        const ytId = extractYoutubeId(lesson.youtubeUrl);
        if (ytId) {
          const area = link?.closest('.a0-explanation');
          if (area) {
            area.innerHTML = `
              <div class="a0-video-wrap">
                <iframe src="https://www.youtube.com/embed/${ytId}" allowfullscreen loading="lazy"></iframe>
              </div>`;
          }
        }
      }
    } catch { /* video not critical */ }
  }

  function extractYoutubeId(url) {
    const m = url.match(/(?:youtu\.be\/|v=)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    if (!sectionId) {
      document.getElementById('lesson-body').innerHTML = '<div class="a0-loading">Урок не найден.</div>';
      return;
    }
    try {
      const resp = await fetch(DATA_URL);
      const data = await resp.json();
      allSections = data.sections;
      section = allSections.find(s => s.id === sectionId);
      if (!section) throw new Error('Section not found');

      document.title = `${section.title} · A0`;
      steps = buildSteps(section);
      updateProgress();
      renderStep();
    } catch (e) {
      const body = document.getElementById('lesson-body');
      if (body) body.innerHTML = '<div class="a0-loading">Ошибка загрузки.</div>';
      console.error(e);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
}());
