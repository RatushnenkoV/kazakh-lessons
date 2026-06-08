/* ===== INDEX PAGE LOGIC ===== */
/* Renders the lessons grid on the main page */

window.KazApp = (function () {

  const LESSONS_META = [
    {
      id: 1,
      title: 'Урок 1',
      topicKz: 'Сәлемдесу және танысу',
      topicRu: 'Приветствие и знакомство',
      icon: '👋',
      description: 'Приветствие и прощание, как спросить о самочувствии, числа до 1000, цвета, базар и продукты.',
      tags: ['Приветствия','Числа','Цвета','Базар'],
      href: 'lesson-1.html',
    },
    {
      id: 2,
      title: 'Урок 2',
      topicKz: 'Дәмхана және мейрамхана',
      topicRu: 'Кафе и ресторан',
      icon: '🍽️',
      description: 'Как найти кафе, сделать заказ, понять меню, попросить счёт и оплатить.',
      tags: ['Ресторан','Желательное','Повелительное','Степени сравнения'],
      href: 'lesson-2.html',
    },
  ];

  function init() {
    renderGrid();
  }

  function renderGrid() {
    const grid = document.getElementById('lessons-grid');
    if (!grid) return;

    grid.innerHTML = LESSONS_META.map(lesson => {
      const tags = lesson.tags.map(t =>
        `<span class="lesson-tag">${t}</span>`
      ).join('');
      return `
        <a href="${lesson.href}" class="lesson-card">
          <div class="lesson-card-top">
            <div class="lesson-card-icon">${lesson.icon}</div>
            <div class="lesson-card-title">
              <h3>${lesson.title}</h3>
              <div class="topic-kz">${lesson.topicKz}</div>
              <div class="topic-ru">${lesson.topicRu}</div>
            </div>
          </div>
          <div class="lesson-card-desc">${lesson.description}</div>
          <div class="lesson-card-footer">
            <div class="lesson-card-tags">${tags}</div>
            <span class="lesson-card-arrow">→</span>
          </div>
        </a>`;
    }).join('');
  }

  return { init };

}());

document.addEventListener('DOMContentLoaded', () => {
  KazApp.init();
  // Tab switching is part of init flow
  (function initTabs() {
    const tabs = document.querySelectorAll('.level-tab-btn');
    const sA0 = document.getElementById('section-a0');
    const sA1 = document.getElementById('section-a1');
    if (!tabs.length) return;
    function setLevel(level) {
      tabs.forEach(t => t.classList.toggle('active', t.dataset.level === level));
      if (sA0) sA0.style.display = level === 'a0' ? '' : 'none';
      if (sA1) sA1.style.display = level === 'a1' ? '' : 'none';
      localStorage.setItem('kaz-level', level);
    }
    tabs.forEach(t => t.addEventListener('click', () => setLevel(t.dataset.level)));
    setLevel(localStorage.getItem('kaz-level') || 'a1');
  }());
});
