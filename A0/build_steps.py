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


def split_at_bold(html, markers):
    """
    Split HTML into chunks at <p> or <b> tags whose text starts with a marker.
    More permissive than split_at_paragraph — also catches inline bold headings.
    """
    soup = BeautifulSoup(html, 'lxml')
    body = soup.find('body') or soup

    chunks = []
    current_parts = []

    def is_marker(tag):
        text = tag.get_text(strip=True)
        return any(text.startswith(m) for m in markers)

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
    parts = {title: body for title, body in chunks}
    before_h3 = parts.get(None, html)
    glasnye   = parts.get('Гласные', '')
    sogl      = parts.get('Согласные', '')

    return [
        {
            'title': 'Казахский алфавит',
            'html': before_h3,
            'practice': {
                'type': 'find-letters',
                'instruction': 'Найди все 9 букв, которые есть только в казахском',
                'target': 9,
                'letters': [
                    {'char': 'Ə', 'kazakh': True},
                    {'char': 'Ғ', 'kazakh': True},
                    {'char': 'Қ', 'kazakh': True},
                    {'char': 'Ң', 'kazakh': True},
                    {'char': 'Ө', 'kazakh': True},
                    {'char': 'Ұ', 'kazakh': True},
                    {'char': 'Ү', 'kazakh': True},
                    {'char': 'Һ', 'kazakh': True},
                    {'char': 'І', 'kazakh': True},
                    # distractors — also in Russian
                    {'char': 'Г', 'kazakh': False},
                    {'char': 'Е', 'kazakh': False},
                    {'char': 'Ш', 'kazakh': False},
                    {'char': 'Ъ', 'kazakh': False},
                    {'char': 'Щ', 'kazakh': False},
                    {'char': 'Ё', 'kazakh': False},
                    {'char': 'Ж', 'kazakh': False},
                    {'char': 'Х', 'kazakh': False},
                    {'char': 'Э', 'kazakh': False},
                ]
            }
        },
        {
            'title': 'Гласные звуки',
            'html': glasnye,
            'practice': {
                'type': 'match-pairs',
                'instruction': 'Каждая твёрдая гласная имеет мягкую пару. Соедини их!',
                'pairs': [['А', 'Ə'], ['О', 'Ө'], ['Ұ', 'Ү'], ['Ы', 'І']]
            }
        },
        {
            'title': 'Согласные и ударение',
            'html': sogl,
            'practice': {
                'type': 'sort-words',
                'instruction': 'Твёрдое или мягкое слово?',
                'groups': ['Твёрдое 🧱', 'Мягкое 🪶'],
                'items': [
                    {'word': 'жұмыс',   'hint': 'работа',  'correct': 0},
                    {'word': 'дәрігер', 'hint': 'врач',    'correct': 1},
                    {'word': 'орман',   'hint': 'лес',     'correct': 0},
                    {'word': 'тіл',     'hint': 'язык',    'correct': 1},
                    {'word': 'дос',     'hint': 'друг',    'correct': 0},
                    {'word': 'өмір',    'hint': 'жизнь',   'correct': 1},
                    {'word': 'тамақ',   'hint': 'еда',     'correct': 0},
                    {'word': 'сөз',     'hint': 'слово',   'correct': 1},
                ]
            }
        }
    ]


def build_steps_prav(html):
    chunks = split_at_paragraph(html, [
        'Слово мягкое',
        'Теперь переходим к правилу',
    ])
    while len(chunks) < 3:
        chunks.append('')

    return [
        {
            'title': 'Твёрдые слова',
            'html': chunks[0],
            'practice': {
                'type': 'sort-words',
                'instruction': 'Перетащи слова по корзинам',
                'groups': ['Твёрдое 🧱', 'Мягкое 🪶'],
                'items': [
                    {'word': 'қоян',  'hint': 'заяц',    'correct': 0},
                    {'word': 'дос',   'hint': 'друг',    'correct': 0},
                    {'word': 'есік',  'hint': 'дверь',   'correct': 1},
                    {'word': 'жұмыс', 'hint': 'работа',  'correct': 0},
                    {'word': 'тіл',   'hint': 'язык',    'correct': 1},
                    {'word': 'тамақ', 'hint': 'еда',     'correct': 0},
                ]
            }
        },
        {
            'title': 'Мягкие слова и особые случаи',
            'html': chunks[1],
            'practice': {
                'type': 'sort-words',
                'instruction': 'Перетащи слова по корзинам',
                'groups': ['Твёрдое 🧱', 'Мягкое 🪶'],
                'items': [
                    {'word': 'ит',    'hint': 'собака',   'correct': 1},
                    {'word': 'су',    'hint': 'вода',     'correct': 0},
                    {'word': 'пәтер', 'hint': 'квартира', 'correct': 1},
                    {'word': 'дауыс', 'hint': 'голос',    'correct': 0},
                    {'word': 'сүю',   'hint': 'любить',   'correct': 1},
                    {'word': 'қою',   'hint': 'ставить',  'correct': 0},
                ]
            }
        },
        {
            'title': 'Закон сингармонизма',
            'html': chunks[2],
            'practice': {
                'type': 'match-pairs',
                'instruction': 'Соедини слово с правильным окончанием «в/на»',
                'pairs': [
                    ['жұмыс', '-та'],
                    ['есік',  '-те'],
                    ['орман', '-да'],
                    ['өмір',  '-де'],
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
                'type': 'match-pairs',
                'instruction': 'Соедини слово с формой после добавления окончания',
                'pairs': [
                    ['күрек + і',  'күрегі'],
                    ['тарақ + ы',  'тарағы'],
                    ['шарап + ы',  'шарабы'],
                    ['мектеп + ім', 'мектебім'],
                ]
            }
        },
        {
            'title': 'Ассимиляция в глаголах',
            'html': chunks[1],
            'practice': {
                'type': 'match-pairs',
                'instruction': 'Соедини повелительную форму с инфинитивом',
                'pairs': [
                    ['тік  (шей)',    'тігу'],
                    ['жап  (закрой)', 'жабу'],
                    ['шық  (выйди)',  'шығу'],
                ]
            }
        }
    ]


def build_steps_proiz(html):
    chunks = split_at_h3(html)
    parts = {title: body for title, body in chunks}
    glasnye = parts.get('Гласные звуки', html)
    soglasn = parts.get('Согласные звуки', '')

    return [
        {
            'title': 'Гласные звуки',
            'html': glasnye,
            'practice': {
                'type': 'match-pairs',
                'instruction': 'Соедини слово с тем, как оно реально звучит',
                'pairs': [
                    ['жұлдыз',   '[жұлдұз]'],
                    ['бүгін',    '[бүгүн]'],
                    ['ойыншық',  '[ойұншұқ]'],
                    ['болды',    '[болдұ]'],
                ]
            }
        },
        {
            'title': 'Согласные звуки',
            'html': soglasn,
            'practice': {
                'type': 'match-pairs',
                'instruction': 'Как на самом деле произносится это слово?',
                'pairs': [
                    ['жексенбі', '[жексембі]'],
                    ['үш жыл',   '[үш шыл]'],
                    ['кесші',    '[кешші]'],
                    ['ізші',     '[ішші]'],
                ]
            }
        }
    ]


def build_steps_fonraz(html):
    # Split at the "Гласные" bold/underline heading that separates intro from classification
    chunks = split_at_bold(html, ['Гласные', 'Согласные'])
    while len(chunks) < 3:
        chunks.append('')

    intro   = chunks[0]   # alphabet, counts, vowel/consonant lists
    glasnye = chunks[1]   # vowel classification tables
    soglasn = chunks[2]   # consonant classification tables

    return [
        {
            'title': 'Алфавит и звуки',
            'html': intro,
            'practice': {
                'type': 'find-letters',
                'instruction': 'Найди все буквы, которые есть только в казахском',
                'target': 9,
                'letters': [
                    {'char': 'Ə', 'kazakh': True},
                    {'char': 'Ғ', 'kazakh': True},
                    {'char': 'Қ', 'kazakh': True},
                    {'char': 'Ң', 'kazakh': True},
                    {'char': 'Ө', 'kazakh': True},
                    {'char': 'Ұ', 'kazakh': True},
                    {'char': 'Ү', 'kazakh': True},
                    {'char': 'Һ', 'kazakh': True},
                    {'char': 'І', 'kazakh': True},
                    {'char': 'Г', 'kazakh': False},
                    {'char': 'Е', 'kazakh': False},
                    {'char': 'Ш', 'kazakh': False},
                    {'char': 'Н', 'kazakh': False},
                    {'char': 'О', 'kazakh': False},
                    {'char': 'Б', 'kazakh': False},
                    {'char': 'Д', 'kazakh': False},
                    {'char': 'З', 'kazakh': False},
                    {'char': 'М', 'kazakh': False},
                ]
            }
        },
        {
            'title': 'Гласные звуки',
            'html': glasnye,
            'practice': {
                'type': 'sort-words',
                'instruction': 'Перетащи каждую букву в нужную корзину',
                'groups': ['Гласная 🎵', 'Согласная 🎸'],
                'items': [
                    {'word': 'а', 'hint': '',  'correct': 0},
                    {'word': 'б', 'hint': '',  'correct': 1},
                    {'word': 'ə', 'hint': '',  'correct': 0},
                    {'word': 'г', 'hint': '',  'correct': 1},
                    {'word': 'е', 'hint': '',  'correct': 0},
                    {'word': 'д', 'hint': '',  'correct': 1},
                    {'word': 'ы', 'hint': '',  'correct': 0},
                    {'word': 'н', 'hint': '',  'correct': 1},
                    {'word': 'ү', 'hint': '',  'correct': 0},
                    {'word': 'м', 'hint': '',  'correct': 1},
                ]
            }
        },
        {
            'title': 'Классификация гласных',
            'html': soglasn,
            'practice': {
                'type': 'match-pairs',
                'instruction': 'Соедини гласную с её характеристикой',
                'pairs': [
                    ['а', 'жуан (твёрдая)'],
                    ['ə', 'жіңішке (мягкая)'],
                    ['о', 'еріндік (губная)'],
                    ['ы', 'қысаң (узкая)'],
                ]
            }
        }
    ]


# ── Main ───────────────────────────────────────────────────────────────────

BUILDERS = {
    'su_fonetika': build_steps_fonetika,
    'su_prav':     build_steps_prav,
    'su_prav2':    build_steps_prav2,
    'su_proiz':    build_steps_proiz,
    'su_fonraz':   build_steps_fonraz,
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
