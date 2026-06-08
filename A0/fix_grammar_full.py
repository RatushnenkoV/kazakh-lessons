"""
Post-processing fix for grammar_full.json:
 1. Remove detyam children (children's stories, not grammar lessons)
 2. Remove sluzh_im children (duplicates of послелог subsections)
 3. Fix su_prit2 / su_prit3 titles to show "2 лицо" / "3 лицо"
 4. Fix su_vved children titles where page title == parent title
 5. Re-fetch only the sections with wrong titles (minimises HTTP calls)
"""

import sys
import json
import re
import time
import requests
from bs4 import BeautifulSoup
sys.stdout.reconfigure(encoding='utf-8')

BASE = 'https://kaz-tili.kz/'
DELAY = 0.5

def fetch_soup(path):
    url = BASE + path if not path.startswith('http') else path
    r = requests.get(url, timeout=15)
    r.encoding = 'utf-8'
    return BeautifulSoup(r.text, 'lxml')

def get_submenu_links(soup):
    seen = set()
    links = []
    for a in soup.find_all('a', class_='pmenu'):
        href = a.get('href', '').strip()
        title = a.get_text(strip=True)
        if href and not href.startswith(('http', '#', 'mailto')) and href not in seen:
            seen.add(href)
            links.append((href, title))
    return links

def build_nav_titles(parent_htm):
    """Fetch parent page and return {href: nav_title} mapping."""
    soup = fetch_soup(parent_htm)
    time.sleep(DELAY)
    result = {}
    for href, title in get_submenu_links(soup):
        if href not in result:
            result[href] = title
    return result

with open('kaz-content/grammar_full.json', encoding='utf-8') as f:
    data = json.load(f)

sections = data['sections']
print(f'Input: {len(sections)} sections')

# ── 1. Remove detyam children ────────────────────────────────────────────────
sections = [s for s in sections if s.get('parentId') != 'detyam']
print(f'After removing detyam children: {len(sections)}')

# ── 2. Remove sluzh_im children (duplicates of послелог children) ────────────
sections = [s for s in sections if s.get('parentId') != 'sluzh_im']
print(f'After removing sluzh_im children: {len(sections)}')

# ── 3. Fix titles using nav link text from parent pages ──────────────────────
# Build a map of sections that need title correction:
# cases where section title == parent section title (likely wrong)
id_map = {s['id']: s for s in sections}

# For each top-level section, re-fetch nav to get proper child titles
tops_with_children = [
    s for s in sections
    if not s.get('parentId') and any(c.get('parentId') == s['id'] for c in sections)
]

print(f'\nRe-fetching nav for {len(tops_with_children)} parent sections...')

title_corrections = {}
for top in tops_with_children:
    parent_htm = top['url'].replace(BASE, '')
    print(f'  Nav for: {parent_htm}')
    try:
        nav = build_nav_titles(parent_htm)
    except Exception as e:
        print(f'  ERROR: {e}')
        continue

    children = [s for s in sections if s.get('parentId') == top['id']]
    for child in children:
        child_htm = child['url'].replace(BASE, '')
        nav_title = nav.get(child_htm)
        if nav_title and nav_title != child['title']:
            print(f'    Fix: {child["id"]} | "{child["title"]}" -> "{nav_title}"')
            title_corrections[child['id']] = nav_title

# Apply corrections
for s in sections:
    if s['id'] in title_corrections:
        s['title'] = title_corrections[s['id']]

# ── 4. Deduplicate by ID (keep first occurrence) ─────────────────────────────
seen_ids = set()
unique_sections = []
for s in sections:
    if s['id'] not in seen_ids:
        seen_ids.add(s['id'])
        unique_sections.append(s)

print(f'\nAfter dedup: {len(unique_sections)} sections')

# ── 5. Report ─────────────────────────────────────────────────────────────────
tops = [s for s in unique_sections if not s.get('parentId')]
subs = [s for s in unique_sections if s.get('parentId')]
words_total = sum(len(s.get('words', [])) for s in unique_sections)
sents_total = sum(len(s.get('sentences', [])) for s in unique_sections)

print(f'Top-level: {len(tops)}, Subsections: {len(subs)}')
print(f'Total words: {words_total}, Total sentences: {sents_total}')

with open('kaz-content/grammar_full.json', 'w', encoding='utf-8') as f:
    json.dump({'sections': unique_sections}, f, ensure_ascii=False, indent=2)

print('\nSaved grammar_full.json')
