"""Fix grammar_full.json: replace \x96 with en-dash, strip bgcolor from tables, remove empty tables."""
import json
import re
from bs4 import BeautifulSoup, Comment, NavigableString, Tag

IN_PATH = 'kaz-content/grammar_full.json'

with open(IN_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

def fix_text(text):
    if not text:
        return text
    return text.replace('\x96', '–').replace('\x97', '—').replace('\x95', '•').replace('\x93', '"').replace('\x94', '"')

def is_empty_table(tag):
    """True if table has no visible text (only comments/whitespace)."""
    if tag.name != 'table':
        return False
    text = tag.get_text(strip=True)
    return not text

def clean_soup(soup):
    for tag in soup.find_all(True):
        tag.attrs.pop('bgcolor', None)
        tag.attrs.pop('background', None)

    # Remove empty tables (contain only comments/whitespace — image placeholders that didn't scrape)
    for tbl in soup.find_all('table'):
        if is_empty_table(tbl):
            # Also remove a preceding "Итоговый рисунок:" paragraph if present
            prev = tbl.find_previous_sibling()
            while prev and isinstance(prev, NavigableString) and not prev.strip():
                prev = prev.find_previous_sibling()
            if prev and isinstance(prev, Tag) and prev.name == 'p':
                text = prev.get_text(strip=True)
                if 'рисунок' in text.lower() or 'схема' in text.lower() or 'таблица' in text.lower():
                    prev.decompose()
            tbl.decompose()

def process_html(html):
    if not html:
        return html
    html = fix_text(html)
    soup = BeautifulSoup(html, 'lxml')
    clean_soup(soup)
    result = str(soup)
    result = re.sub(r'^<html><body>', '', result)
    result = re.sub(r'</body></html>$', '', result)
    return result.strip()

changed = 0
for section in data['sections']:
    if section.get('explanation'):
        section['explanation'] = fix_text(section['explanation'])

    html = section.get('explanationHtml', '')
    if html:
        result = process_html(html)
        if result != html:
            section['explanationHtml'] = result
            changed += 1

    for step in section.get('steps', []):
        if step.get('html'):
            step['html'] = process_html(step['html'])

with open(IN_PATH, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'Fixed {changed} sections')
