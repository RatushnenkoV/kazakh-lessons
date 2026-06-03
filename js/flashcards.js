/* ===== FLASHCARD SYSTEM ===== */
/* Features:
   - Flip cards (KZ ↔ RU)
   - Mark as learned (persisted in localStorage)
   - View learned list + remove from learned
   - Review mode (cycles through all cards including learned)
   - Shuffle
*/

window.KazFlashcards = (function () {

  /* ================================================================
     STORAGE HELPERS
     ================================================================ */
  function storageKey(lessonId, type) {
    return `kaz-learned-L${lessonId}-${type}`;
  }

  function getLearnedIds(lessonId, type) {
    try {
      return JSON.parse(localStorage.getItem(storageKey(lessonId, type)) || '[]');
    } catch { return []; }
  }

  function saveLearnedIds(lessonId, type, ids) {
    try {
      localStorage.setItem(storageKey(lessonId, type), JSON.stringify(ids));
    } catch {}
  }

  function addLearned(lessonId, type, id) {
    const ids = getLearnedIds(lessonId, type);
    if (!ids.includes(id)) { ids.push(id); saveLearnedIds(lessonId, type, ids); }
  }

  function removeLearned(lessonId, type, id) {
    const ids = getLearnedIds(lessonId, type).filter(x => x !== id);
    saveLearnedIds(lessonId, type, ids);
  }

  /* ================================================================
     FLASHCARD DECK STATE
     ================================================================ */
  const decks = {}; // deckId → state object

  function initDeck(deckId, lessonId, type, cards, container) {
    const learned = getLearnedIds(lessonId, type);
    const state = {
      deckId, lessonId, type,
      allCards: cards,
      order: cards.map((_, i) => i),
      currentIdx: 0,
      flipped: false,
      reviewMode: false,
      showingLearned: false,
    };
    decks[deckId] = state;
    renderDeck(deckId, container);
  }

  /* ================================================================
     RENDER DECK
     ================================================================ */
  function renderDeck(deckId, container) {
    const state = decks[deckId];
    const {lessonId, type, allCards, order, currentIdx} = state;
    const learned = getLearnedIds(lessonId, type);
    const total = allCards.length;
    const learnedCount = learned.length;

    /* --- Stats bar --- */
    const statsHtml = `
      <div class="fc-stats">
        <div class="fc-stat">
          <div class="fc-stat-num">${total}</div>
          <div class="fc-stat-label">Всего</div>
        </div>
        <div class="fc-stat-divider"></div>
        <div class="fc-stat">
          <div class="fc-stat-num" style="color:var(--accent)">${learnedCount}</div>
          <div class="fc-stat-label">Выучено</div>
        </div>
        <div class="fc-stat-divider"></div>
        <div class="fc-stat">
          <div class="fc-stat-num" style="color:var(--secondary)">${total - learnedCount}</div>
          <div class="fc-stat-label">Осталось</div>
        </div>
      </div>`;

    /* --- Mode bar --- */
    const modebar = `
      <div class="fc-modebar">
        <button class="fc-mode-btn${!state.reviewMode ? ' active' : ''}" onclick="KazFlashcards.setMode('${deckId}', false)">📖 Учить</button>
        <button class="fc-mode-btn review-mode${state.reviewMode ? ' active' : ''}" onclick="KazFlashcards.setMode('${deckId}', true)">🔁 Повторение всего</button>
        <button class="fc-mode-btn" onclick="KazFlashcards.toggleLearned('${deckId}', event)"
          style="${learnedCount === 0 ? 'opacity:.4' : ''}">
          ⭐ Выученные (${learnedCount})
        </button>
      </div>`;

    /* --- Current card --- */
    const cardIdx  = order[currentIdx] !== undefined ? order[currentIdx] : 0;
    const card     = allCards[cardIdx] || allCards[0];
    const isLearned = learned.includes(card.id);

    const frontText = card.kz;
    const backText  = card.ru;
    const cardNote  = card.note || '';

    const cardHtml = `
      <div class="fc-card-area">
        <div class="fc-progress-bar-wrap">
          <div class="fc-progress-bar" style="width:${Math.round((currentIdx+1)/order.length*100)}%"></div>
        </div>
        <div class="fc-card-wrap" onclick="KazFlashcards.flipCard('${deckId}')">
          <div class="fc-card${state.flipped ? ' flipped' : ''}" id="fc-card-${deckId}">
            <div class="fc-card-face fc-card-front">
              <div class="fc-card-lang">Қазақша</div>
              <div class="fc-card-text">${escHtml(frontText)}</div>
              ${cardNote ? `<div class="fc-card-note">${escHtml(cardNote)}</div>` : ''}
              <div class="fc-flip-hint">Нажмите, чтобы перевернуть</div>
              ${isLearned ? `<div class="fc-learned-badge" title="Выучено">⭐</div>` : ''}
            </div>
            <div class="fc-card-face fc-card-back">
              <div class="fc-card-lang">Русский</div>
              <div class="fc-card-text">${escHtml(backText)}</div>
              ${cardNote ? `<div class="fc-card-note">${escHtml(cardNote)}</div>` : ''}
              ${isLearned ? `<div class="fc-learned-badge" title="Выучено">⭐</div>` : ''}
            </div>
          </div>
        </div>

        <div class="fc-nav">
          <button class="fc-nav-btn" onclick="KazFlashcards.prevCard('${deckId}')"
            ${currentIdx === 0 ? 'disabled' : ''}>◀</button>
          <div class="fc-counter">${currentIdx+1} / ${order.length}</div>
          <button class="fc-nav-btn" onclick="KazFlashcards.nextCard('${deckId}')"
            ${currentIdx === order.length-1 ? 'disabled' : ''}>▶</button>
        </div>

        <div class="fc-action-row">
          <button class="fc-learn-btn${isLearned ? ' learned' : ''}"
            onclick="KazFlashcards.toggleLearnCard('${deckId}')">
            <span class="learn-icon"></span>
            ${isLearned ? 'Убрать из выученных' : 'Пометить как выученное'}
          </button>
          <button class="fc-shuffle-btn" onclick="KazFlashcards.shuffleDeck('${deckId}')">🔀 Перемешать</button>
        </div>
      </div>`;

    /* --- Learned list panel --- */
    const learnedPanel = state.showingLearned ? buildLearnedPanel(deckId) : '';

    /* --- Review mode banner --- */
    const reviewBanner = state.reviewMode
      ? `<div class="fc-review-banner">🔁 Режим повторения — все карточки, включая выученные, повторяются по кругу</div>`
      : '';

    container.innerHTML = `
      <div class="flashcard-tab">
        ${modebar}
        ${statsHtml}
        ${reviewBanner}
        ${cardHtml}
        ${learnedPanel}
      </div>`;
  }

  function buildLearnedPanel(deckId) {
    const state = decks[deckId];
    const learned = getLearnedIds(state.lessonId, state.type);
    const learnedCards = state.allCards.filter(c => learned.includes(c.id));

    if (learnedCards.length === 0) {
      return `
        <div class="fc-learned-panel">
          <div class="fc-learned-panel-header">⭐ Выученные карточки</div>
          <div class="fc-learned-empty">Вы ещё не пометили ни одной карточки как выученную.</div>
        </div>`;
    }

    const items = learnedCards.map(c => `
      <div class="fc-learned-item">
        <div class="fc-learned-item-kz">${escHtml(c.kz)}</div>
        <div class="fc-learned-item-ru">${escHtml(c.ru)}</div>
        <button class="fc-unlearn-btn" onclick="KazFlashcards.removeFromLearned('${deckId}', ${c.id})">✕ Убрать</button>
      </div>`).join('');

    return `
      <div class="fc-learned-panel">
        <div class="fc-learned-panel-header">⭐ Выученные карточки (${learnedCards.length})</div>
        <div class="fc-learned-list">${items}</div>
      </div>`;
  }

  /* ================================================================
     ACTIONS
     ================================================================ */

  function flipCard(deckId) {
    const state = decks[deckId];
    state.flipped = !state.flipped;
    const cardEl = document.getElementById(`fc-card-${deckId}`);
    if (cardEl) {
      cardEl.classList.toggle('flipped', state.flipped);
    }
  }

  function nextCard(deckId) {
    const state = decks[deckId];
    if (state.currentIdx < state.order.length - 1) {
      state.currentIdx++;
    } else if (state.reviewMode) {
      // Loop in review mode
      state.currentIdx = 0;
    }
    state.flipped = false;
    rerender(deckId);
  }

  function prevCard(deckId) {
    const state = decks[deckId];
    if (state.currentIdx > 0) {
      state.currentIdx--;
      state.flipped = false;
      rerender(deckId);
    }
  }

  function toggleLearnCard(deckId) {
    const state = decks[deckId];
    const card = state.allCards[state.order[state.currentIdx]];
    if (!card) return;
    const learned = getLearnedIds(state.lessonId, state.type);
    if (learned.includes(card.id)) {
      removeLearned(state.lessonId, state.type, card.id);
    } else {
      addLearned(state.lessonId, state.type, card.id);
      // Animate hearts if marking as learned
      showHearts(deckId);
    }
    rerender(deckId);
  }

  function removeFromLearned(deckId, cardId) {
    const state = decks[deckId];
    removeLearned(state.lessonId, state.type, cardId);
    rerender(deckId);
  }

  function toggleLearned(deckId, event) {
    const state = decks[deckId];
    state.showingLearned = !state.showingLearned;
    rerender(deckId);
  }

  function setMode(deckId, reviewMode) {
    const state = decks[deckId];
    state.reviewMode = reviewMode;
    state.currentIdx = 0;
    state.flipped = false;

    if (reviewMode) {
      // Show all cards
      state.order = state.allCards.map((_, i) => i);
    } else {
      state.order = state.allCards.map((_, i) => i);
    }
    rerender(deckId);
  }

  function shuffleDeck(deckId) {
    const state = decks[deckId];
    const arr = [...state.order];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    state.order = arr;
    state.currentIdx = 0;
    state.flipped = false;
    rerender(deckId);
  }

  function showHearts(deckId) {
    const cardEl = document.getElementById(`fc-card-${deckId}`);
    if (!cardEl) return;
    const rect = cardEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    ['💛','⭐','✨'].forEach((em, i) => {
      const el = document.createElement('div');
      el.textContent = em;
      el.style.cssText = `
        position:fixed;
        left:${cx + (Math.random()-0.5)*60}px;
        top:${cy}px;
        font-size:1.5rem;
        pointer-events:none;
        z-index:9999;
        animation: confettiFall .8s ease forwards;
        animation-delay:${i*0.12}s;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1200);
    });
  }

  /* ================================================================
     RE-RENDER HELPER
     ================================================================ */
  function rerender(deckId) {
    const container = document.querySelector(`[data-deck-id="${deckId}"]`);
    if (container) renderDeck(deckId, container);
  }

  /* ================================================================
     INIT ENTRY POINT (called from lesson.js)
     ================================================================ */
  function mount(container, lessonId, type, cards) {
    const deckId = `deck-${lessonId}-${type}`;
    container.dataset.deckId = deckId;
    initDeck(deckId, lessonId, type, cards, container);
  }

  /* ---------------------------------------------------------------- */
  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/\n/g,'<br>');
  }

  return {
    mount,
    flipCard,
    nextCard,
    prevCard,
    toggleLearnCard,
    removeFromLearned,
    toggleLearned,
    setMode,
    shuffleDeck,
  };

}());
