"""
Разбивает все разделы A0 на смысловые шаги (steps[]).
Логика:
  1. Zag-сплит — по <span class="zag"> маркерам
  2. Numbered-p-сплит — по <p>N. / <p>N) / <p><b>N)</b>
  3. Bold-header сплит — по <p><b>Заголовок</b></p>
  4. Одиночный шаг — остальные разделы
  5. Пропуск — пустые разделы (len=0)
"""

import json, re, sys

sys.stdout.reconfigure(encoding='utf-8')

with open('kaz-content/grammar_full.json', encoding='utf-8') as f:
    data = json.load(f)

sections = data if isinstance(data, list) else data.get('sections', [])


# ─── утилиты ────────────────────────────────────────────────────────────────

def strip_tail(html):
    """Убрать 'По данной теме' и видео-ссылки с конца HTML."""
    html = re.sub(r'\s*(<br/>\s*)?<hr/?>\s*(По данной теме:?|<br/>).*$', '',
                  html, flags=re.DOTALL)
    html = re.sub(r'\s*По данной теме:?.*$', '', html, flags=re.DOTALL)
    # Убрать висячие таблицы-навигации с ссылками (после <br/> в конце)
    html = re.sub(r'(\s*<br/>\s*){2,}$', '', html)
    return html.strip()

def plain(html):
    """HTML → plain text для заголовков."""
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', html)).strip()

def shorten(text, n=50):
    text = text.strip().rstrip(':.,')
    return text[:n] if len(text) <= n else text[:n-1].rstrip() + '…'


def zag_title(zag_raw, after_html):
    """Осмысленный заголовок из zag-маркера и следующего за ним текста."""
    z = plain(zag_raw).strip()
    # Именованные zag — используем как есть
    if not re.match(r'^[\d]+[\.\)]$', z) and len(z) > 2:
        return z
    # Попробуем вытащить суффикс/окончание из скобок: (дан/ден)
    after_plain = plain(after_html)[:300]
    m = re.search(r'\(([^)]{2,30})\)', after_plain)
    if m:
        s = m.group(1).strip()
        if '/' in s or len(s) < 20:
            return s
    # Убрать ведущий номер из текста (чтобы split('.') не срезал его)
    clean = re.sub(r'^\d+[\.\)]\s*', '', after_plain)
    # Попробуем суффикс после ▶
    m2 = re.search(r'▶\s*([^\s▶,]{2,20})', clean)
    if m2:
        return m2.group(1).strip()
    first = clean[:80].split('.')[0].split(',')[0].strip()
    return shorten(first) if first else f'Часть {z}'


def split_by_zag(title, html):
    """Сплит по <span class="zag">…</span>.
    Обрабатывает zag внутри <p>, <center> или после <br/>."""
    html = strip_tail(html)
    # lookahead: zag предшествует <p>, <center> или <br/> (без вложенных тегов)
    # <p> обрабатывает <p><span class="zag"> и <p><b><span class="zag">
    # <br/> обрабатывает только прямой случай: <br/>\n<span class="zag"> (без <p>-обёртки)
    sep = (r'(?='
           r'<(?:p|center)[^>]*>\s*(?:<[^>]+>)*\s*<span\s+class="zag">'
           r'|'
           r'<br\s*/?>\s*(?:\r?\n\s*)?<span\s+class="zag">'
           r')')
    raw_parts = re.split(sep, html, flags=re.DOTALL)
    # Убрать паразитные микро-части (возникают при двойном срабатывании на <p><br/><span class="zag">)
    parts = []
    for p in raw_parts:
        if parts and len(p.strip()) < 15 and 'class="zag"' not in p:
            parts[-1] += p  # прилепить к предыдущей части
        else:
            parts.append(p)

    if len(parts) == 1:
        return [{'title': title, 'html': html}]

    steps = []
    intro = parts[0].strip()
    if intro:
        steps.append({'title': title, 'html': intro})

    for part in parts[1:]:
        # Вытащить текст самого zag-тэга
        zm = re.search(r'<span\s+class="zag">(.*?)</span>', part, re.DOTALL)
        zag_raw = zm.group(1) if zm else ''
        # Текст первого абзаца (или <center>) для извлечения заголовка
        after_block = re.search(r'<(?:p|center)[^>]*>(.*?)</(?:p|center)>', part, re.DOTALL)
        after_raw = after_block.group(1) if after_block else part[:200]
        t = zag_title(zag_raw, after_raw)
        steps.append({'title': t, 'html': part.strip()})

    return steps


def split_by_numbered_p(title, html):
    """Сплит по <p>N. / <p>N) / <p><b>N)</b>…"""
    html = strip_tail(html)
    # lookahead: <p>, опциональные теги, цифра+./), затем не-цифра (не 10+ и пр.)
    # Убрали требование \s после цифры — там может стоять тег
    sep = r'(?=<p[^>]*>\s*(?:<[^>]+>)*\s*\d+[\.\)](?:[^0-9]|$))'
    parts = re.split(sep, html, flags=re.DOTALL)
    if len(parts) == 1:
        return [{'title': title, 'html': html}]

    steps = []
    intro = parts[0].strip()
    if intro:
        steps.append({'title': title, 'html': intro})

    for part in parts[1:]:
        if not part.strip():
            continue
        pm = re.search(r'<p[^>]*>(.*?)</p>', part, re.DOTALL)
        raw = plain(pm.group(1)) if pm else ''
        # Убрать ведущий номер
        raw = re.sub(r'^\d+[\.\)]\s*', '', raw)
        t = shorten(raw) if raw else 'Раздел'
        steps.append({'title': t, 'html': part.strip()})

    return steps


def split_by_bold_header(title, html):
    """Сплит по <p><b>Заголовок</b></p>."""
    html = strip_tail(html)
    sep = r'(?=<p[^>]*>\s*<b>[^<]{3,}</b>\s*</p>)'
    parts = re.split(sep, html, flags=re.DOTALL)
    if len(parts) == 1:
        return [{'title': title, 'html': html}]

    steps = []
    intro = parts[0].strip()
    if intro:
        steps.append({'title': title, 'html': intro})

    for part in parts[1:]:
        hm = re.search(r'<b>([^<]+)</b>', part)
        t = shorten(plain(hm.group(1))) if hm else title
        steps.append({'title': t, 'html': part.strip()})

    return steps


def single(title, html):
    html = strip_tail(html)
    return [{'title': title, 'html': html}] if html else []


# ─── Определяем шаги для каждого раздела ────────────────────────────────────

SKIP = {  # пустые разделы — шаги не нужны
    'glv', 'glvat21', 'glvat22', 'glvat23',
    'glvat01', 'glvat02', 'glvat03', 'glvat04', 'glvat05',
    'glvat06', 'glvat07', 'glvat08', 'glvat09', 'glvat10',
}

# Разделы с ручными шагами — не перезаписывать
MANUAL = {'su_fonetika', 'su_prav', 'su_prav2', 'su_proiz', 'su_fonraz'}

# Разделы с zag-маркерами
ZAG_SPLIT = {
    'su_prit', 'su_prit2', 'su_prit3',
    'su_mesto1', 'su_mesto2', 'su_mesto3', 'su_mesto',
    'su_rod1', 'su_rod', 'su_rod3', 'su_mn1', 'su_mn3', 'su_tvorit',
    'gl05',
    'glag2', 'glag3', 'glag4', 'glag6', 'glag7', 'glag8',
    'glag9', 'glag10', 'glag11',
    'glv01', 'glv02', 'glv12',
    'narech',
}

# Разделы с нумерованными абзацами
NUMBERED_SPLIT = {
    'su_npad', 'su_krtab', 'su_obrazov', 'su_izafet',
    'prilag', 'prilag1', 'prilag2', 'prilag3',
    'gl01', 'gl02',
    'lichnie1',
    'deeprich',
    'predl_pr1', 'predl_pr2',
    'predl_pod1', 'predl_pod2', 'predl_pod3',
    'predl_pod4_1', 'predl_pod4_2', 'predl_pod4_3',
    'predl_pod5', 'predl_pod6',
    'predl_soch',
    'soyuzi', 's_chast',
    'prichast1', 'prichast2', 'prichast3',
    'chislit01', 'chislit02', 'chislit03', 'chislit04',
    'chislit01vr', 'chislit02vr',
    'modal4',
}

# Одиночный шаг
SINGLE = {
    'su_baza', 'su_vved', 'lichnie', 'gl00', 'glag1',
    'chislit', 'chislit05', 'chislit06',
    'prichast', 'prichast4', 'modal', 'predl_vved',
    'su_rod2', 'detyam', 's_mezhd', 'gl04',
    'poslelog', 'su_krshem',
    'predl_pod0', 'predl_pod4',
    'mestoim',
    'lichnie2', 'lichnietab',
    'modal3', 'modal8',
    'mest5', 'mest6', 'mest7',
    'poslelogtab',
}

# ─── Специальная разбивка для разделов без авто-маркеров ────────────────────

def custom_steps(sec):
    """Ручная разбивка для разделов, которые требуют специального подхода."""
    sid = sec['id']
    title = sec['title']
    html = strip_tail(sec.get('explanationHtml', ''))

    # ── Послелоги: каждая секция уже об одной падежной группе,
    #    но содержит несколько отдельных послелогов в таблицах
    if sid in ('poslelog01', 'poslelog02', 'poslelog03', 'poslelog04'):
        # Каждый послелог начинается с <table>
        parts = re.split(r'(?=<table\b)', html, flags=re.DOTALL)
        if len(parts) > 1:
            steps = []
            intro = parts[0].strip()
            if intro:
                steps.append({'title': title, 'html': intro})
            for p in parts[1:]:
                if not p.strip():
                    continue
                # Имя послелога: первый kaz-span в первой ячейке таблицы
                table_m = re.search(r'<table[^>]*>(.*?)</table>', p, re.DOTALL)
                lbl = 'послелог'
                if table_m:
                    km = re.search(r'<span\s+class="kaz">\s*\xa0?\s*(.*?)\s*</span>',
                                   table_m.group(1), re.DOTALL)
                    if km:
                        lbl = plain(km.group(1)).strip() or 'послелог'
                steps.append({'title': lbl, 'html': p.strip()})
            return steps
        return single(title, html)

    # ── Служебные имена: intro + пространственные слова
    if sid == 'sluzh_im':
        # Разбить: intro + верх/низ/перед/зад + внутри/снаружи + между/рядом + дополнительные
        # Используем пустые строки / <br/> как разделители
        # Структура: вводный абзац, затем список слов с примерами
        # Разбить на: intro (вводный абзац), + примеры использования
        # Ищем жирные слова в начале примеров
        # Разбить по: üстінде / астында / алдында / артында / ішінде / сыртында / арасында / жанында
        # Проще: разбить на ~3 части по смыслу (верт., гориз., прочее)
        # Так как нет маркеров — единый шаг
        return single(title, html)

    # ── Местоимения: личные, возвратные и т.д.
    if sid == 'mest1':
        # Именительный → склонение по падежам → с/без притяжательных окончаний
        # Ищем "Склонение" как ключевое слово
        idx = html.find('Склонение')
        if idx > 100:
            return [
                {'title': 'Именительный падеж и примеры', 'html': html[:idx].strip()},
                {'title': 'Склонение по падежам', 'html': html[idx:].strip()},
            ]
        return single(title, html)

    if sid == 'mest2':
        # Intro + именительный + склонение + примеры
        idx = html.find('Склонение')
        if idx > 100:
            return [
                {'title': 'Образование и именительный падеж', 'html': html[:idx].strip()},
                {'title': 'Склонение по падежам', 'html': html[idx:].strip()},
            ]
        return single(title, html)

    if sid == 'mest3':
        # бұл/мынау (вблизи) + сол/ол/ана (вдали) + склонение
        idx_sol = html.find('сол,')
        idx_skl = html.find('Склонение')
        if idx_sol > 100 and idx_skl > idx_sol:
            return [
                {'title': 'бұл, осы, мына — вблизи говорящего', 'html': html[:idx_sol].strip()},
                {'title': 'сол, ол, ана — вдали от говорящего', 'html': html[idx_sol:idx_skl].strip()},
                {'title': 'Склонение по падежам', 'html': html[idx_skl:].strip()},
            ]
        return single(title, html)

    if sid == 'mest4':
        # Список вопросительных слов + склонение кім/не + примеры остальных
        idx_kim = html.find('кім?')
        idx_skl = html.find('Склонение')
        if idx_kim >= 0 and idx_skl > 0:
            return [
                {'title': 'Список вопросительных слов', 'html': html[:idx_skl].strip()},
                {'title': 'Склонение кім/не по падежам', 'html': html[idx_skl:].strip()},
            ]
        return single(title, html)

    # ── Беглые гласные: правило + список слов
    if sid == 'su_pritglas':
        idx = html.find('Ниже приведён список')
        if idx > 0:
            return [
                {'title': 'Правило беглых гласных', 'html': html[:idx].strip()},
                {'title': 'Список слов с беглой гласной', 'html': html[idx:].strip()},
            ]
        return single(title, html)

    # ── Прямая речь: структурные схемы
    if sid == 'predl_pr3':
        return split_by_numbered_p(title, html)

    # ── Косвенная речь
    if sid == 'predl_pr4':
        # Разбить на: intro + косв. без деепричастия + косв. с деепричастием + примеры
        # Ищем нумерованные блоки
        steps = split_by_numbered_p(title, html)
        return steps if len(steps) > 1 else single(title, html)

    # ── Вспомогательные глаголы (малые секции): разбить по значениям
    if sid == 'glv03':
        # 1) попробовать + 2) другие
        return split_by_numbered_p(title, html)

    if sid == 'glv05':
        # 1. ради себя (ып + алу) + 2. мочь/суметь (а/е/й + ала + алмау)
        idx2 = re.search(r'\n2\.', html)
        if idx2:
            return [
                {'title': 'ып/іп/п алу — действие ради себя', 'html': html[:idx2.start()].strip()},
                {'title': 'а/е/й алу — мочь, суметь', 'html': html[idx2.start():].strip()},
            ]
        return single(title, html)

    if sid == 'glv06':
        # 1. ради другого + 2. дополнительные значения
        idx2 = re.search(r'\n2\.', html)
        if idx2:
            return [
                {'title': 'ып/іп/п беру — действие ради другого', 'html': html[:idx2.start()].strip()},
                {'title': 'Другие значения беру', 'html': html[idx2.start():].strip()},
            ]
        return single(title, html)

    if sid == 'glv07':
        # тұру + жүру + отыру + жату — разбить по глаголам
        return split_by_numbered_p(title, html)

    if sid == 'glv09':
        # значение решительности + значение «навсегда»
        return split_by_numbered_p(title, html)

    if sid == 'glv10':
        # 1. прямая речь + 2. эмоции (деп)
        return split_by_numbered_p(title, html)

    if sid == 'glv11':
        # основное значение + вспомогательные а/б/в
        return split_by_numbered_p(title, html)

    # ── Глагол gl03 (неопределённая форма): intro + склонение + в роли подлеж. + ...
    if sid == 'gl03':
        idx_skl = html.find('Склонение по падежам')
        idx_sub = re.search(r'в роли (подлеж|сказ)', html)
        if idx_skl > 0:
            parts = [html[:idx_skl].strip()]
            if idx_sub and idx_sub.start() > idx_skl:
                parts.append(html[idx_skl:idx_sub.start()].strip())
                parts.append(html[idx_sub.start():].strip())
            else:
                parts.append(html[idx_skl:].strip())
            titles = ['Понятие и образование', 'Склонение по падежам', 'Синтаксические функции']
            return [{'title': titles[i], 'html': p} for i, p in enumerate(parts) if p]
        return single(title, html)

    # ── Основа глагола gl06: intro + таблица + закономерности
    if sid == 'gl06':
        idx_tab = html.find('<table')
        idx_zak = re.search(r'закономерност|основ[а-я]+ глагол[а-я]+ с', html, re.IGNORECASE)
        if idx_tab > 0 and idx_zak:
            return [
                {'title': 'Понятие основы глагола', 'html': html[:idx_tab].strip()},
                {'title': 'Таблица основ и примеры', 'html': html[idx_tab:].strip()},
            ]
        return single(title, html)

    # ── Желательное наклонение glag5
    if sid == 'glag5':
        # Схема → правила суффиксов → формы с притяжательными окончаниями → отрицание → вопрос
        idx_neg = re.search(r'[Оо]трица', html)
        idx_q = re.search(r'[Вв]опрос', html)
        if idx_neg:
            steps = [
                {'title': 'Схема и образование', 'html': html[:idx_neg.start()].strip()},
            ]
            if idx_q and idx_q.start() > idx_neg.start():
                steps.append({'title': 'Отрицательная форма', 'html': html[idx_neg.start():idx_q.start()].strip()})
                steps.append({'title': 'Вопросительная форма', 'html': html[idx_q.start():].strip()})
            else:
                steps.append({'title': 'Отрицательная форма', 'html': html[idx_neg.start():].strip()})
            return [s for s in steps if s['html']]
        return single(title, html)

    # ── modal1 (глагол алу — мочь)
    if sid == 'modal1':
        idx_past = re.search(r'[Пп]рошедш', html)
        idx_neg = re.search(r'[Оо]тр[іи]ц', html)
        if idx_past and idx_neg and idx_neg.start() > idx_past.start():
            return [
                {'title': 'Переходное время — ала мын', 'html': html[:idx_past.start()].strip()},
                {'title': 'Прошедшее время — алды', 'html': html[idx_past.start():idx_neg.start()].strip()},
                {'title': 'Отрицательная форма — алмаймын', 'html': html[idx_neg.start():].strip()},
            ]
        return single(title, html)

    # ── modal2 (болу — можно)
    if sid == 'modal2':
        idx_neg = re.search(r'[Оо]трица|[Нн]ельзя', html)
        idx_q = re.search(r'[Вв]опрос', html)
        if idx_neg:
            parts = [html[:idx_neg.start()].strip()]
            if idx_q and idx_q.start() > idx_neg.start():
                parts.append(html[idx_neg.start():idx_q.start()].strip())
                parts.append(html[idx_q.start():].strip())
            else:
                parts.append(html[idx_neg.start():].strip())
            titles = ['Конструкция глаголу+ға болады', 'Нельзя — болмайды', 'Вопросительная форма']
            return [{'title': titles[i], 'html': p} for i, p in enumerate(parts) if p]
        return single(title, html)

    # ── modal5 (шығар, сияқты): по временам
    if sid == 'modal5':
        return split_by_numbered_p(title, html)

    # ── modal6 (ұнау, ұнату, жақсы көру)
    if sid == 'modal6':
        # Split at clean paragraph boundaries
        idx_2 = html.find('<p>Теперь')
        idx_3 = re.search(r'<p>С глаголами\b', html)
        if idx_2 > 0 and idx_3:
            return [
                {'title': 'ұнау и ұнату: нравиться / одобрять', 'html': html[:idx_2].strip()},
                {'title': 'нравиться с глаголами действия', 'html': html[idx_2:idx_3.start()].strip()},
                {'title': 'жақсы көру / жек көру', 'html': html[idx_3.start():].strip()},
            ]
        return single(title, html)

    # ── modal7 (тура келу), modal9 (тиіс): одиночные шаги уже в SINGLE,
    #    но на всякий случай
    if sid in ('modal7', 'modal9'):
        return single(title, html)

    # ── Причастия 4 (тұру/жүру/отыру/жату)
    if sid == 'prichast4':
        return single(title, html)

    # ── predl_pr2 (порядок слов): уже в NUMBERED_SPLIT

    return None  # вернём None → будет применён общий алгоритм


# ─── Главный цикл ───────────────────────────────────────────────────────────

changed = 0
skipped = 0
already = 0

for sec in sections:
    sid = sec['id']

    # Ручные шаги не трогаем, остальные перегенерируем
    if sid in MANUAL and sec.get('steps'):
        already += 1
        continue

    html = sec.get('explanationHtml', '')
    title = sec['title']

    if sid in SKIP or not html.strip():
        skipped += 1
        continue

    # ── Выбор стратегии ─────────────────────────────
    steps = None

    if sid in ZAG_SPLIT:
        steps = split_by_zag(title, html)
    elif sid in NUMBERED_SPLIT:
        steps = split_by_numbered_p(title, html)
    elif sid in SINGLE:
        steps = single(title, html)
    else:
        steps = custom_steps(sec)
        if steps is None:
            # Последний резерв: попробовать zag, потом numbered, потом single
            if re.search(r'class="zag"', html):
                steps = split_by_zag(title, html)
            elif re.search(r'<p[^>]*>\s*(?:<[^>]+>)*\s*\d+[\.\)](?:[^0-9]|$)', html):
                steps = split_by_numbered_p(title, html)
            else:
                steps = single(title, html)

    if not steps:
        skipped += 1
        continue

    sec['steps'] = steps
    changed += 1

# ─── Сохранение ─────────────────────────────────────────────────────────────

with open('kaz-content/grammar_full.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'Разбито: {changed}, уже были: {already}, пропущено: {skipped}')
print(f'Всего разделов: {len(sections)}')

# Выведем сводку по разбитым разделам
for sec in sections:
    if sec.get('steps') and sec['id'] not in SKIP:
        n = len(sec['steps'])
        titles = [s['title'][:30] for s in sec['steps']]
        print(f"  {sec['id']:20} → {n} шага/ов: {titles}")
