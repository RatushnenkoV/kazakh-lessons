/* ===== A0 LESSON PAGE ===== */
/* Steps: intro → explanation (+ video) → vocab cards → exercise → complete */

(function () {
  'use strict';

  const DATA_URL     = 'kaz-content/grammar_parsed.json';
  const PROGRESS_KEY = 'a0-progress';
  const WORDS_KEY    = 'a0-words'; // spaced repetition storage

  // ── URL param ──────────────────────────────────────────────────────────────
  const sectionId = new URLSearchParams(location.search).get('id') || '';

  // ── State ──────────────────────────────────────────────────────────────────
  let section = null;
  let steps   = [];  // array of step descriptors
  let stepIdx = 0;

  // Word learning state for this session
  let vocabQueue  = [];  // words to show this session
  let vocabIndex  = 0;
  let vocabFlipped = false;
  let vocabDir    = 'kaz'; // 'kaz' = show kaz, ask for ru; 'ru' = show ru, ask for kaz

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

  // Spaced repetition word store: { 'sectionId:wordIdx': { correct: N, wrong: N } }
  function getWordStore() {
    try { return JSON.parse(localStorage.getItem(WORDS_KEY)) || {}; }
    catch { return {}; }
  }
  function wordKey(sectionId, wordIdx) { return `${sectionId}:${wordIdx}`; }
  function recordWord(sectionId, wordIdx, correct) {
    const store = getWordStore();
    const key = wordKey(sectionId, wordIdx);
    const rec = store[key] || { correct: 0, wrong: 0 };
    if (correct) rec.correct++; else rec.wrong++;
    store[key] = rec;
    localStorage.setItem(WORDS_KEY, JSON.stringify(store));
  }
  function isWordLearned(sectionId, wordIdx) {
    const store = getWordStore();
    const rec = store[wordKey(sectionId, wordIdx)] || { correct: 0 };
    return rec.correct >= 3;
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
    list.push({ type: 'explanation' });
    if (sec.relatedVideos.length) list.push({ type: 'video' });
    if (sec.words.length)         list.push({ type: 'vocab' });
    if (sec.sentences.length >= 3) list.push({ type: 'exercise' });
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

  // ── Render dispatcher ─────────────────────────────────────────────────────
  function renderStep() {
    const body = document.getElementById('lesson-body');
    if (!body) return;
    const step = steps[stepIdx];
    if (!step) return;

    switch (step.type) {
      case 'intro':       body.innerHTML = renderIntro();       break;
      case 'explanation': body.innerHTML = renderExplanation(); break;
      case 'video':       body.innerHTML = renderVideo();       break;
      case 'vocab':       initVocab(); body.innerHTML = renderVocabFrame(); break;
      case 'exercise':    body.innerHTML = renderExercise();    break;
      case 'complete':    markDone(section.id); body.innerHTML = renderComplete(); break;
    }

    // Attach event listeners after render
    attachListeners(step.type);
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
    const text = section.explanation || '';
    // Split into paragraphs on double-space or numbered items or known markers
    const paras = text
      .replace(/(\d+\))/g, '\n$1')   // newline before '1)', '2)'
      .replace(/([А-ЯЁ]{2,}:)/g, '\n$1') // newline before UPPERCASE labels
      .split(/\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 10);

    const html = paras.map(p => `<p>${p}</p>`).join('');

    return `
      <h3 style="font-size:1.2rem;font-weight:900;margin-bottom:20px">${section.title}</h3>
      <div class="a0-explanation">${html || '<p>Раздел без текстового объяснения. Смотри видео.</p>'}</div>
      <button class="a0-nav-btn" id="btn-next">Продолжить →</button>`;
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
    if (btn && type !== 'vocab') btn.addEventListener('click', goNext);

    if (type === 'vocab')     attachVocabListeners();
    if (type === 'exercise')  attachExerciseListeners();

    if (type === 'video') {
      // Load video URL from videocourse data
      loadVideoUrl();
    }
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
