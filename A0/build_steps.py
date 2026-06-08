"""
Build custom steps for Базовые правила sections.
Splits explanationHtml into semantic chunks and adds practice data.
Stores result as section['steps'] in grammar_full.json.
"""
import json
from bs4 import BeautifulSoup, Tag, NavigableString

IN_PATH = 'kaz-content/grammar_full.json'

# ── HTML splitting helpers ─────────────────────────────────────────────────

def split_at_h3(html):
    """Split HTML into chunks at <h3> boundaries. Returns list of (h3_title, html_str)."""
    soup = BeautifulSoup(html, 'lxml')
    body = soup.find('body') or soup

    chunks = []
    current_title = None
    current_parts = []

    for child in body.children:
        if isinstance(child, Tag) and child.name == 'h3':
            if current_parts:
                chunks.append((current_title, ''.join(str(p) for p in current_parts)))
            current_title = child.get_text(strip=True)
            current_parts = []
        else:
            current_parts.append(child)

    if current_parts:
        chunks.append((current_title, ''.join(str(p) for p in current_parts)))

    return chunks


def split_at_paragraph(html, markers):
    """
    Split HTML into chunks. markers = list of paragraph text prefixes that
    mark the START of a new chunk. Returns list of html strings.
    """
    soup = BeautifulSoup(html, 'lxml')
    body = soup.find('body') or soup

    chunks = []
    current_parts = []

    def is_marker(tag):
        if tag.name != 'p':
            return False
        text = tag.get_text(strip=True)
        for m in markers:
            if text.startswith(m):
                return True
        return False

    for child in body.children:
        if isinstance(child, Tag) and is_marker(child):
            if current_parts:
                chunks.append(''.join(str(p) for p in current_parts))
            current_parts = [child]
        else:
            current_parts.append(child)

    if current_parts:
        chunks.append(''.join(str(p) for p in current_parts))

    return chunks


# ── Step definitions ───────────────────────────────────────────────────────

def build_steps_fonetika(html):
    chunks = split_at_h3(html)
    # chunks: [(None, алфавит), ('Гласные', гласные), ('Согласные', согл+удар)]
    parts = {title: body for title, body in chunks}
    before_h3 = parts.get(None, html)
    glasnye   = parts.get('Гласные', '')
    sogl      = parts.get('Согласные', '')

    return [
        {
            'title': 'Казахский алфавит',
            'html': before_h3,
            'practice': {
                'type': 'match-pairs',
                'instruction': 'Каждая твёрдая гласная имеет мягкую пару. Соедини их!',
                'pairs': [['А', 'Ә'], ['О', 'Ө'], ['Ұ', 'Ү'], ['Ы', 'І']]
            }
        },
        {
            'title': 'Гласные звуки',
            'html': glasnye,
            'practice': {
                'type': 'sort-words',
                'instruction': 'Твёрдое или мягкое слово?',
                'groups': ['Твёрдое 💪', 'Мягкое 🌸'],
                'items': [
                    {'word': 'жұмыс',    'hint': 'работа',   'correct': 0},
                    {'word': 'дәрігер',  'hint': 'врач',     'correct': 1},
                    {'word': 'орман',    'hint': 'лес',      'correct': 0},
                    {'word': 'тіл',      'hint': 'язык',     'correct': 1},
                    {'word': 'дос',      'hint': 'друг',     'correct': 0},
                    {'word': 'өмір',     'hint': 'жизнь',    'correct': 1},
                    {'word': 'тамақ',    'hint': 'еда',      'correct': 0},
                    {'word': 'сөз',      'hint': 'слово',    'correct': 1},
                ]
            }
        },
        {
            'title': 'Согласные и ударение',
            'html': sogl,
            'practice': {
                'type': 'pick-one',
                'instruction': 'Проверь себя',
                'questions': [
                    {
                        'prompt': 'Буква Қ — это…',
                        'options': ['Твёрдый вариант К', 'Звонкий звук', 'То же что Г', 'Мягкий звук'],
                        'correct': 0
                    },
                    {
                        'prompt': 'Буква Ғ — это…',
                        'options': ['Звонкий Г (как в слове «город»)', 'Глухой звук', 'То же что Q', 'Шипящий'],
                        'correct': 0
                    },
                    {
                        'prompt': 'На какой слог падает ударение в казахском?',
                        'options': ['На последний', 'На первый', 'На предпоследний', 'Всегда на второй'],
                        'correct': 0
                    }
                ]
            }
        }
    ]


def build_steps_prav(html):
    # Split at "Слово мягкое" and "Теперь переходим"
    chunks = split_at_paragraph(html, [
        'Слово мягкое',
        'Теперь переходим к правилу',
    ])
    # chunks[0] = твёрдые, chunks[1] = мягкие + И/У/Я, chunks[2] = сингармонизм
    while len(chunks) < 3:
        chunks.append('')

    return [
        {
            'title': 'Твёрдые слова',
            'html': chunks[0],
            'practice': {
                'type': 'sort-words',
                'instruction': 'Отбери все твёрдые слова',
                'groups': ['Твёрдое 💪', 'Мягкое 🌸'],
                'items': [
                    {'word': 'қоян',    'hint': 'заяц',       'correct': 0},
                    {'word': 'дос',     'hint': 'друг',       'correct': 0},
                    {'word': 'есік',    'hint': 'дверь',      'correct': 1},
                    {'word': 'жұмыс',   'hint': 'работа',     'correct': 0},
                    {'word': 'тіл',     'hint': 'язык',       'correct': 1},
                    {'word': 'тамақ',   'hint': 'еда',        'correct': 0},
                ]
            }
        },
        {
            'title': 'Мягкие слова и особые случаи',
            'html': chunks[1],
            'practice': {
                'type': 'sort-words',
                'instruction': 'Твёрдое или мягкое?',
                'groups': ['Твёрдое 💪', 'Мягкое 🌸'],
                'items': [
                    {'word': 'ит',       'hint': 'собака',    'correct': 1},
                    {'word': 'су',       'hint': 'вода',      'correct': 0},
                    {'word': 'пәтер',    'hint': 'квартира',  'correct': 1},
                    {'word': 'дауыс',    'hint': 'голос',     'correct': 0},
                    {'word': 'сүю',      'hint': 'целовать',  'correct': 1},
                    {'word': 'қою',      'hint': 'ставить',   'correct': 0},
                ]
            }
        },
        {
            'title': 'Закон сингармонизма',
            'html': chunks[2],
            'practice': {
                'type': 'pick-one',
                'instruction': 'Выбери правильное окончание',
                'questions': [
                    {
                        'prompt': 'жұмыс + ___  (в / на)',
                        'options': ['-та', '-те', '-да', '-де'],
                        'correct': 0
                    },
                    {
                        'prompt': 'есік + ___  (в / на)',
                        'options': ['-та', '-те', '-да', '-де'],
                        'correct': 1
                    },
                    {
                        'prompt': 'орман + ___  (в / на)',
                        'options': ['-та', '-те', '-да', '-де'],
                        'correct': 2
                    },
                    {
                        'prompt': 'дәрігер + ___  (у / при)',
                        'options': ['-та', '-те', '-да', '-де'],
                        'correct': 3
                    }
                ]
            }
        }
    ]


def build_steps_prav2(html):
    chunks = split_at_paragraph(html, [
        'Правило регрессивной ассимиляции действует и с глаголами',
    ])
    while len(chunks) < 2:
        chunks.append('')

    return [
        {
            'title': 'Правило и примеры',
            'html': chunks[0],
            'practice': {
                'type': 'pick-one',
                'instruction': 'Добавь притяжательное окончание',
                'questions': [
                    {
                        'prompt': 'күрек + і  =  ?',
                        'options': ['күрегі', 'күреки', 'күрекі', 'күрекы'],
                        'correct': 0
                    },
                    {
                        'prompt': 'тарақ + ы  =  ?',
                        'options': ['тарақы', 'тарағы', 'тарагы', 'тараки'],
                        'correct': 1
                    },
                    {
                        'prompt': 'шарап + ы  =  ?',
                        'options': ['шарапы', 'шарабы', 'шараби', 'шарапі'],
                        'correct': 1
                    },
                    {
                        'prompt': 'мектеп + ім  =  ?',
                        'options': ['мектепім', 'мектебім', 'мектепіш', 'мектебі'],
                        'correct': 1
                    }
                ]
            }
        },
        {
            'title': 'Ассимиляция в глаголах',
            'html': chunks[1],
            'practice': {
                'type': 'pick-one',
                'instruction': 'Выбери правильную форму глагола',
                'questions': [
                    {
                        'prompt': 'Неопределённая форма от «тік» (шей)?',
                        'options': ['тіку', 'тігу', 'тикку', 'тікі'],
                        'correct': 1
                    },
                    {
                        'prompt': 'Неопределённая форма от «жап» (закрой)?',
                        'options': ['жапу', 'жабу', 'жапі', 'жаппу'],
                        'correct': 1
                    },
                    {
                        'prompt': 'Неопределённая форма от «шық» (выйди)?',
                        'options': ['шығу', 'шықу', 'шыку', 'шыги'],
                        'correct': 0
                    }
                ]
            }
        }
    ]


# ── Main ───────────────────────────────────────────────────────────────────

BUILDERS = {
    'su_fonetika': build_steps_fonetika,
    'su_prav':     build_steps_prav,
    'su_prav2':    build_steps_prav2,
}

with open(IN_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

for section in data['sections']:
    builder = BUILDERS.get(section['id'])
    if not builder:
        continue
    html = section.get('explanationHtml', '')
    steps = builder(html)
    section['steps'] = steps
    print(f"{section['id']}: {len(steps)} steps")
    for s in steps:
        print(f"  - {s['title']} ({len(s['html'])} chars) + practice: {s['practice']['type']}")

with open(IN_PATH, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print('\nSaved.')
