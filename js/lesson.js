/* ===== LESSON PAGE ORCHESTRATOR ===== */
/* Renders all sections, mounts exercises and flashcard decks */

window.KazLesson = (function () {

  let currentLessonData = null;

  /* ================================================================
     INIT – called on DOMContentLoaded from lesson page
     ================================================================ */
  function init(lessonId) {
    const data = window.LESSON_DATA && window.LESSON_DATA[lessonId];
    if (!data) { console.error('No lesson data for id', lessonId); return; }
    currentLessonData = data;

    // Render lesson tab
    renderLessonTab(data);

    // Mount flashcard decks (lazy – wait until tab shown)
    setupTabs(data);

    // Update header info
    const iconEl = document.getElementById('header-lesson-icon');
    const titleEl = document.getElementById('header-lesson-title');
    const subtitleEl = document.getElementById('header-lesson-subtitle');
    if (iconEl) iconEl.textContent = data.icon;
    if (titleEl) titleEl.textContent = data.title;
    if (subtitleEl) subtitleEl.textContent = `${data.topicKz} / ${data.topicRu}`;

    document.title = `${data.title} — Казахский язык`;
  }

  /* ================================================================
     RENDER LESSON TAB
     ================================================================ */
  function renderLessonTab(data) {
    const container = document.getElementById('tab-lesson');
    if (!container) return;

    const sectionsHtml = data.lesson.sections.map((section, idx) =>
      KazComponents.renderSection(section, idx)
    ).join('');

    container.innerHTML = `<div class="lesson-container">${sectionsHtml}</div>`;

    // Mount exercises into their placeholder divs
    data.lesson.sections.forEach(section => {
      section.blocks.forEach(block => {
        if (block.type !== 'exercise') return;
        const ex = block.exercise;
        const placeholder = container.querySelector(`.exercise-placeholder[data-exercise-id="${ex.id}"]`);
        if (!placeholder) return;
        KazExercises.buildExercise(ex, placeholder);
      });
    });
  }

  /* ================================================================
     TABS
     ================================================================ */
  function setupTabs(data) {
    const buttons  = document.querySelectorAll('.tab-btn');
    const panes    = document.querySelectorAll('.tab-pane');
    let wordsReady = false;
    let sentencesReady = false;

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;

        buttons.forEach(b => b.classList.remove('active'));
        panes.forEach(p => { p.classList.remove('active'); });

        btn.classList.add('active');
        const pane = document.getElementById(`tab-${tab}`);
        if (pane) pane.classList.add('active');

        // Lazy mount flashcard decks
        if (tab === 'words' && !wordsReady) {
          const container = document.getElementById('tab-words');
          if (container) {
            KazFlashcards.mount(container, data.id, 'words', data.words);
            wordsReady = true;
          }
        }
        if (tab === 'sentences' && !sentencesReady) {
          const container = document.getElementById('tab-sentences');
          if (container) {
            KazFlashcards.mount(container, data.id, 'sentences', data.sentences);
            sentencesReady = true;
          }
        }

        // Scroll to top of content
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  /* ================================================================
     SECTION COLLAPSE TOGGLE
     ================================================================ */
  function toggleSection(headerEl) {
    const section = headerEl.closest('.section-block');
    if (section) section.classList.toggle('collapsed');
  }

  /* ================================================================
     PUBLIC API
     ================================================================ */
  return { init, toggleSection };

}());
