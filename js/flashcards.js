/* ===== FLASHCARD SYSTEM ===== */
window.KazFlashcards = (function () {

  /* ================================================================
     STORAGE  (rev = true → Рус→Каз direction, separate progress)
     ================================================================ */
  function storageKey(lessonId, type, rev) {
    return `kaz-learned-L${lessonId}-${type}${rev ? '-rev' : ''}`;
  }

  function getLearnedIds(lessonId, type, rev) {
    try { return JSON.parse(localStorage.getItem(storageKey(lessonId, type, rev)) || '[]'); }
    catch { return []; }
  }

  function saveLearnedIds(lessonId, type, rev, ids) {
    try { localStorage.setItem(storageKey(lessonId, type, rev), JSON.stringify(ids)); } catch {}
  }

  function addLearned(lessonId, type, rev, id) {
    const ids = getLearnedIds(lessonId, type, rev);
    if (!ids.includes(id)) { ids.push(id); saveLearnedIds(lessonId, type, rev, ids); }
  }

  function removeLearned(lessonId, type, rev, id) {
    saveLearnedIds(lessonId, type, rev,
      getLearnedIds(lessonId, type, rev).filter(x => x !== id));
  }

  /* ================================================================
     STATE
     ================================================================ */
  const decks = {};
  const swipeCleanups = {};

  function unlearnedOrder(cards, lessonId, type, rev) {
    const learned = getLearnedIds(lessonId, type, rev);
    return cards.map((_, i) => i).filter(i => !learned.includes(cards[i].id));
  }

  function initDeck(deckId, lessonId, type, cards, container) {
    decks[deckId] = {
      deckId, lessonId, type,
      allCards: cards,
      reversed: false,
      order: unlearnedOrder(cards, lessonId, type, false),
      currentIdx: 0,
      flipped: false,
      reviewMode: false,
      showingLearned: false,
    };
    renderDeck(deckId, container);
    attachSwipeGesture(deckId);
  }

  /* ================================================================
     RENDER
     ================================================================ */
  function renderDeck(deckId, container) {
    const state = decks[deckId];
    const { lessonId, type, allCards, order, currentIdx, reversed } = state;
    const learned = getLearnedIds(lessonId, type, reversed);
    const total = allCards.length;
    const learnedCount = learned.length;

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

    const dirBar = `
      <div class="fc-dir-bar">
        <button class="fc-dir-btn${!reversed ? ' active' : ''}" onclick="KazFlashcards.setDirection('${deckId}', false)">Каз → Рус</button>
        <button class="fc-dir-btn${reversed ? ' active' : ''}" onclick="KazFlashcards.setDirection('${deckId}', true)">Рус → Каз</button>
      </div>`;

    const modebar = `
      <div class="fc-modebar">
        <button class="fc-mode-btn${!state.reviewMode ? ' active' : ''}" onclick="KazFlashcards.setMode('${deckId}', false)">📖 Учить</button>
        <button class="fc-mode-btn review-mode${state.reviewMode ? ' active' : ''}" onclick="KazFlashcards.setMode('${deckId}', true)">🔁 Повторение всего</button>
        <button class="fc-mode-btn" onclick="KazFlashcards.toggleLearned('${deckId}')"
          style="${learnedCount === 0 ? 'opacity:.4' : ''}">⭐ Выученные (${learnedCount})</button>
      </div>`;

    /* All learned */
    if (order.length === 0 && !state.reviewMode) {
      container.innerHTML = `
        <div class="flashcard-tab">
          ${dirBar}${modebar}${statsHtml}
          <div class="fc-all-learned">
            <div class="fc-all-learned-icon">🎉</div>
            <div class="fc-all-learned-title">Все слова выучены!</div>
            <div class="fc-all-learned-sub">Переключитесь в режим повторения, чтобы продолжить практику</div>
            <button class="fc-mode-btn review-mode" onclick="KazFlashcards.setMode('${deckId}', true)" style="margin-top:1rem">🔁 Повторение всего</button>
          </div>
        </div>`;
      return;
    }

    const cardIdx   = order[currentIdx] !== undefined ? order[currentIdx] : 0;
    const card      = allCards[cardIdx] || allCards[0];
    const isLearned = learned.includes(card.id);

    const frontText = reversed ? card.ru : card.kz;
    const backText  = reversed ? card.kz : card.ru;
    const frontLang = reversed ? 'Русский' : 'Қазақша';
    const backLang  = reversed ? 'Қазақша' : 'Русский';

    const cardHtml = `
      <div class="fc-card-area">
        <div class="fc-progress-bar-wrap">
          <div class="fc-progress-bar" style="width:${Math.round((currentIdx+1)/order.length*100)}%"></div>
        </div>

        <div class="fc-drag-wrap" id="fc-wrap-${deckId}">
          <div class="fc-swipe-label fc-swipe-know">ЗНАЮ ✓</div>
          <div class="fc-swipe-label fc-swipe-nope">✗ НЕ ЗНАЮ</div>
          <div class="fc-card-wrap" onclick="KazFlashcards.flipCard('${deckId}')">
            <div class="fc-card${state.flipped ? ' flipped' : ''}" id="fc-card-${deckId}">
              <div class="fc-card-face fc-card-front">
                <div class="fc-card-lang">${frontLang}</div>
                <div class="fc-card-text">${escHtml(frontText)}</div>
                <div class="fc-flip-hint">Тап — перевернуть</div>
                ${isLearned ? `<div class="fc-learned-badge" title="Выучено">⭐</div>` : ''}
              </div>
              <div class="fc-card-face fc-card-back">
                <div class="fc-card-lang">${backLang}</div>
                <div class="fc-card-text">${escHtml(backText)}</div>
                ${isLearned ? `<div class="fc-learned-badge" title="Выучено">⭐</div>` : ''}
              </div>
            </div>
          </div>
        </div>

        <div class="fc-swipe-hint-row">
          <span class="fc-hint-nope">← Не знаю</span>
          <span class="fc-hint-know">Знаю →</span>
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

    /* Learned view */
    if (state.showingLearned) {
      container.innerHTML = `
        <div class="flashcard-tab">
          ${dirBar}${modebar}${statsHtml}
          ${buildLearnedPanel(deckId)}
        </div>`;
      return;
    }

    const reviewBanner = state.reviewMode
      ? `<div class="fc-review-banner">🔁 Режим повторения — все карточки, включая выученные, повторяются по кругу</div>`
      : '';

    container.innerHTML = `
      <div class="flashcard-tab">
        ${dirBar}${modebar}${statsHtml}${reviewBanner}${cardHtml}
      </div>`;
  }

  function buildLearnedPanel(deckId) {
    const state = decks[deckId];
    const { lessonId, type, reversed } = state;
    const learned = getLearnedIds(lessonId, type, reversed);
    const learnedCards = state.allCards.filter(c => learned.includes(c.id));

    const backBtn = `
      <button class="fc-back-btn" onclick="KazFlashcards.toggleLearned('${deckId}')">
        ← Назад к карточкам
      </button>`;

    if (learnedCards.length === 0) {
      return `
        <div class="fc-learned-view">
          ${backBtn}
          <div class="fc-learned-view-title">⭐ Выученные слова</div>
          <div class="fc-learned-empty">Вы ещё не пометили ни одного слова как выученное.<br>Свайпайте вправо или нажмите «Пометить как выученное».</div>
        </div>`;
    }

    const items = learnedCards.map(c => `
      <div class="fc-learned-item">
        <div class="fc-learned-item-kz">${escHtml(c.kz)}</div>
        <div class="fc-learned-item-ru">${escHtml(c.ru)}</div>
        <button class="fc-unlearn-btn" onclick="KazFlashcards.removeFromLearned('${deckId}', ${c.id})">✕</button>
      </div>`).join('');

    return `
      <div class="fc-learned-view">
        ${backBtn}
        <div class="fc-learned-view-title">⭐ Выученные слова <span class="fc-learned-view-count">${learnedCards.length}</span></div>
        <div class="fc-learned-list">${items}</div>
      </div>`;
  }

  /* ================================================================
     SWIPE GESTURE
     ================================================================ */
  function attachSwipeGesture(deckId) {
    if (swipeCleanups[deckId]) { swipeCleanups[deckId](); delete swipeCleanups[deckId]; }

    const container = document.querySelector(`[data-deck-id="${deckId}"]`);
    if (!container) return;
    const dragWrap = container.querySelector('.fc-drag-wrap');
    if (!dragWrap) return;

    const THRESHOLD = 80;
    let startX = 0, startY = 0, currentX = 0;
    let isDragging = false, hasMoved = false;

    const knowLabel = dragWrap.querySelector('.fc-swipe-know');
    const nopeLabel = dragWrap.querySelector('.fc-swipe-nope');

    const getPos = e => e.touches
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY };

    const onStart = e => {
      const { x, y } = getPos(e);
      startX = x; startY = y; currentX = 0;
      isDragging = true; hasMoved = false;
      dragWrap.style.transition = 'none';
    };

    const onMove = e => {
      if (!isDragging) return;
      const { x, y } = getPos(e);
      const dx = x - startX, dy = y - startY;
      if (Math.abs(dx) > 8) hasMoved = true;
      if (Math.abs(dx) > Math.abs(dy) && e.cancelable) e.preventDefault();
      currentX = dx;
      dragWrap.style.transform = `translateX(${dx}px) rotate(${dx * 0.06}deg)`;
      const ratio = Math.min(Math.abs(dx) / THRESHOLD, 1);
      if (knowLabel) knowLabel.style.opacity = dx > 0 ? ratio : 0;
      if (nopeLabel) nopeLabel.style.opacity = dx < 0 ? ratio : 0;
    };

    const onEnd = () => {
      if (currentX > THRESHOLD) {
        dragWrap.style.transition = 'transform .35s ease-in';
        dragWrap.style.transform = `translateX(${window.innerWidth}px) rotate(25deg)`;
        if (knowLabel) knowLabel.style.opacity = 1;
        setTimeout(() => swipeKnow(deckId), 350);
      } else if (currentX < -THRESHOLD) {
        dragWrap.style.transition = 'transform .35s ease-in';
        dragWrap.style.transform = `translateX(-${window.innerWidth}px) rotate(-25deg)`;
        if (nopeLabel) nopeLabel.style.opacity = 1;
        setTimeout(() => swipeUnknown(deckId), 350);
      } else {
        dragWrap.style.transition = 'transform .3s cubic-bezier(.25,.8,.25,1)';
        dragWrap.style.transform = '';
        if (knowLabel) knowLabel.style.opacity = 0;
        if (nopeLabel) nopeLabel.style.opacity = 0;
      }
    };

    const onTouchEnd = e => {
      if (!isDragging) return;
      isDragging = false;
      if (!hasMoved) {
        dragWrap.style.transition = '';
        dragWrap.style.transform = '';
        if (knowLabel) knowLabel.style.opacity = 0;
        if (nopeLabel) nopeLabel.style.opacity = 0;
        return;
      }
      e.preventDefault();
      onEnd();
    };

    const onMouseEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      if (!hasMoved) {
        dragWrap.style.transition = '';
        dragWrap.style.transform = '';
        if (knowLabel) knowLabel.style.opacity = 0;
        if (nopeLabel) nopeLabel.style.opacity = 0;
        return;
      }
      onEnd();
    };

    dragWrap.addEventListener('touchstart', onStart, { passive: true });
    dragWrap.addEventListener('touchmove', onMove, { passive: false });
    dragWrap.addEventListener('touchend', onTouchEnd);
    dragWrap.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onMouseEnd);

    swipeCleanups[deckId] = () => {
      dragWrap.removeEventListener('touchstart', onStart);
      dragWrap.removeEventListener('touchmove', onMove);
      dragWrap.removeEventListener('touchend', onTouchEnd);
      dragWrap.removeEventListener('mousedown', onStart);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onMouseEnd);
    };
  }

  function swipeKnow(deckId) {
    const state = decks[deckId];
    const card = state.allCards[state.order[state.currentIdx]];
    if (!card) { rerender(deckId); return; }
    const learned = getLearnedIds(state.lessonId, state.type, state.reversed);
    if (!learned.includes(card.id)) addLearned(state.lessonId, state.type, state.reversed, card.id);
    if (!state.reviewMode) {
      state.order.splice(state.currentIdx, 1);
      if (state.currentIdx >= state.order.length && state.currentIdx > 0) state.currentIdx--;
    } else {
      state.currentIdx = state.currentIdx < state.order.length - 1 ? state.currentIdx + 1 : 0;
    }
    state.flipped = false;
    rerender(deckId);
  }

  function swipeUnknown(deckId) {
    const state = decks[deckId];
    const card = state.allCards[state.order[state.currentIdx]];
    state.flipped = false;
    if (card) {
      const learned = getLearnedIds(state.lessonId, state.type, state.reversed);
      if (learned.includes(card.id)) removeLearned(state.lessonId, state.type, state.reversed, card.id);
    }
    if (state.reviewMode || state.order.length <= 1) { nextCard(deckId); return; }
    const cardIdx = state.order.splice(state.currentIdx, 1)[0];
    state.order.push(cardIdx);
    if (state.currentIdx >= state.order.length) state.currentIdx = 0;
    rerender(deckId);
  }

  /* ================================================================
     ACTIONS
     ================================================================ */
  function flipCard(deckId) {
    const state = decks[deckId];
    state.flipped = !state.flipped;
    const cardEl = document.getElementById(`fc-card-${deckId}`);
    if (cardEl) cardEl.classList.toggle('flipped', state.flipped);
  }

  function nextCard(deckId) {
    const state = decks[deckId];
    if (state.currentIdx < state.order.length - 1) {
      state.currentIdx++;
    } else if (state.reviewMode) {
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
    const { lessonId, type, reversed } = state;
    const learned = getLearnedIds(lessonId, type, reversed);
    if (learned.includes(card.id)) {
      removeLearned(lessonId, type, reversed, card.id);
      if (!state.reviewMode) {
        state.order = unlearnedOrder(state.allCards, lessonId, type, reversed);
        state.currentIdx = Math.min(state.currentIdx, Math.max(0, state.order.length - 1));
      }
    } else {
      addLearned(lessonId, type, reversed, card.id);
      showHearts(deckId);
      if (!state.reviewMode) {
        state.order.splice(state.currentIdx, 1);
        if (state.currentIdx >= state.order.length && state.currentIdx > 0) state.currentIdx--;
      }
    }
    rerender(deckId);
  }

  function removeFromLearned(deckId, cardId) {
    const state = decks[deckId];
    removeLearned(state.lessonId, state.type, state.reversed, cardId);
    rerender(deckId);
  }

  function toggleLearned(deckId) {
    const state = decks[deckId];
    state.showingLearned = !state.showingLearned;
    rerender(deckId);
  }

  function setMode(deckId, reviewMode) {
    const state = decks[deckId];
    state.reviewMode = reviewMode;
    state.currentIdx = 0;
    state.flipped = false;
    state.order = reviewMode
      ? state.allCards.map((_, i) => i)
      : unlearnedOrder(state.allCards, state.lessonId, state.type, state.reversed);
    rerender(deckId);
  }

  function setDirection(deckId, reversed) {
    const state = decks[deckId];
    if (state.reversed === reversed) return;
    state.reversed = reversed;
    state.currentIdx = 0;
    state.flipped = false;
    state.reviewMode = false;
    state.showingLearned = false;
    state.order = unlearnedOrder(state.allCards, state.lessonId, state.type, reversed);
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
    ['💛', '⭐', '✨'].forEach((em, i) => {
      const el = document.createElement('div');
      el.textContent = em;
      el.style.cssText = `
        position:fixed; left:${cx + (Math.random() - 0.5) * 60}px; top:${cy}px;
        font-size:1.5rem; pointer-events:none; z-index:9999;
        animation: confettiFall .8s ease forwards; animation-delay:${i * 0.12}s;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1200);
    });
  }

  function rerender(deckId) {
    const container = document.querySelector(`[data-deck-id="${deckId}"]`);
    if (container) {
      renderDeck(deckId, container);
      attachSwipeGesture(deckId);
    }
  }

  /* ================================================================
     ENTRY POINT
     ================================================================ */
  function mount(container, lessonId, type, cards) {
    const deckId = `deck-${lessonId}-${type}`;
    container.dataset.deckId = deckId;
    initDeck(deckId, lessonId, type, cards, container);
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
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
    setDirection,
    shuffleDeck,
  };

}());
