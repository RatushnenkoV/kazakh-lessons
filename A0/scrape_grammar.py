"""
Scraper for kaz-tili.kz grammar sections.
Builds a comprehensive grammar.json with all subsections.

Usage: python scrape_grammar.py
Output: A0/kaz-content/grammar_full.json
"""

import json
import re
import time
import requests
from bs4 import BeautifulSoup

BASE = 'https://kaz-tili.kz/'
OUT_PATH = 'kaz-content/grammar_full.json'
DELAY = 0.8  # seconds between requests

KAZ_SPECIAL = set('әіңғүұқөһӘІҢҒҮҰҚӨҺ')

def has_kaz(s):
    return any(c in KAZ_SPECIAL for c in s)

def fetch(path):
    url = BASE + path if not path.startswith('http') else path
    r = requests.get(url, timeout=15)
    r.encoding = 'utf-8'
    return BeautifulSoup(r.text, 'lxml'), url

# ── Extract section navigation links (class=pmenu) ──────────────────────────

def get_submenu_links(soup):
    """Return list of (href, title) for subsection nav links."""
    seen = set()
    links = []
    for a in soup.find_all('a', class_='pmenu'):
        href = a.get('href', '').strip()
        title = a.get_text(strip=True)
        if href and not href.startswith(('http', '#', 'mailto')) and href not in seen:
            seen.add(href)
            links.append((href, title))
    return links

# ── Extract content ──────────────────────────────────────────────────────────

def get_page_text(soup):
    """Extract readable text from the main content area."""
    # Remove script, style, nav elements
    for tag in soup(['script', 'style', 'meta', 'link']):
        tag.decompose()

    # Try to find the main content — it's after the submenu table
    # The page layout: header → breadcrumb → submenu → content
    # Grab all text, then strip the header/nav junk
    full_text = soup.get_text(' ', strip=True)

    # Strip everything up to "Автор:" marker (after nav)
    idx = full_text.find('Автор:')
    if idx > 0:
        full_text = full_text[idx:]

    # Strip footer junk: navigation at the bottom
    for marker in ['Главная: Грамматика', 'Главная Грамматика', 'Главная:', 'Главная :']:
        fidx = full_text.rfind(marker)
        if fidx > 0:
            full_text = full_text[:fidx]

    return full_text.strip()

def extract_words(text):
    """Extract kaz–ru word pairs from text."""
    words = []
    seen = set()
    parts = re.split(r'\s+–\s+', text)
    for i in range(len(parts) - 1):
        left_raw = parts[i]
        right_raw = parts[i + 1]

        # Take last "word group" from left (after last sentence-ending punct)
        left = re.split(r'[.!?]\s+', left_raw)[-1].strip()
        # Take first segment from right (before sentence punct or next dash)
        right = re.split(r'[.!?\n]', right_raw)[0].strip()
        # Right: cut at comma
        right = right.split(',')[0].strip()
        # Left: cut at comma
        left = left.split(',')[0].strip()

        # Strip Russian prefix from kaz side
        if not has_kaz(left):
            continue
        words_left = left.split()
        for j, w in enumerate(words_left):
            if has_kaz(w):
                left = ' '.join(words_left[j:])
                break

        # Filter noisy pairs
        if not left or not right:
            continue
        if len(left) > 60 or len(right) > 60:
            continue
        if '.' in left or '(' in left:
            continue
        if has_kaz(right):  # right should be Russian
            continue

        key = (left.lower(), right.lower())
        if key in seen:
            continue
        seen.add(key)
        words.append({'kaz': left, 'ru': right})

    return words

def extract_sentences(text):
    """Extract kaz–ru sentence pairs."""
    sentences = []
    seen = set()
    # Pattern: Kazakh sentence (capital letter, has kaz special) – Russian sentence
    pat = re.compile(
        r'([А-ЯӘІҢҒҮҰҚӨҺA-Z][^–]{6,150}?)\. – ([^–]{5,200}?)\.'
    )
    for m in pat.finditer(text):
        kaz = m.group(1).strip()
        ru = m.group(2).strip()
        if not has_kaz(kaz):
            continue
        if has_kaz(ru):
            continue
        # Strip Russian prefix from kaz
        if ':' in kaz:
            after = kaz.rsplit(':', 1)[-1].strip()
            if after and (after[0].isupper() or has_kaz(after[0])):
                kaz = after
        kaz_words = kaz.split()
        for j, w in enumerate(kaz_words):
            if has_kaz(w):
                kaz = ' '.join(kaz_words[j:])
                break
        key = kaz.lower()[:40]
        if key in seen:
            continue
        seen.add(key)
        sentences.append({'kaz': kaz, 'ru': ru})
    return sentences

# ── Main scrape logic ────────────────────────────────────────────────────────

def scrape_section(href, parent_id=None, section_id=None):
    """Fetch one section page and return a section dict."""
    print(f'  Fetching: {href}')
    try:
        soup, url = fetch(href)
    except Exception as e:
        print(f'  ERROR: {e}')
        return None

    time.sleep(DELAY)

    # Title from page title tag or breadcrumb
    title_tag = soup.find('title')
    title = ''
    if title_tag:
        title = title_tag.get_text(strip=True).split('|')[0].strip()

    text = get_page_text(soup)
    words = extract_words(text)
    sentences = extract_sentences(text)

    sid = section_id or href.replace('.htm', '')

    return {
        'id': sid,
        'title': title,
        'parentId': parent_id,
        'url': url,
        'explanation': text[:3000],
        'words': words,
        'sentences': sentences,
        'relatedVideos': [],
    }

def main():
    # Load existing grammar.json for the top-level section list and order
    with open('kaz-content/grammar.json', encoding='utf-8') as f:
        orig = json.load(f)

    # Build map: id → section from original data
    orig_map = {s['id']: s for s in orig['sections']}

    sections_out = []

    for orig_sec in orig['sections']:
        if orig_sec.get('parentId'):
            # Will be handled below when we process the parent
            continue

        href = orig_sec['url'].replace(BASE, '')
        print(f'\nSection: {orig_sec["title"]} ({href})')

        # Fetch the top-level section page to get its submenu
        try:
            soup, url = fetch(href)
        except Exception as e:
            print(f'  ERROR fetching section: {e}')
            continue
        time.sleep(DELAY)

        submenu = get_submenu_links(soup)
        print(f'  Submenu links: {len(submenu)}')

        # Build the top-level section entry
        text = get_page_text(soup)
        top_entry = {
            'id': orig_sec['id'],
            'title': orig_sec['title'],
            'parentId': None,
            'url': url,
            'explanation': text[:3000],
            'words': extract_words(text),
            'sentences': extract_sentences(text),
            'relatedVideos': [],
        }
        sections_out.append(top_entry)

        if not submenu:
            print(f'  No subsections found.')
            continue

        # Check if orig data already has children for this section
        orig_children = [s for s in orig['sections'] if s.get('parentId') == orig_sec['id']]

        # Use original children if they exist (Глаголы), otherwise scrape from submenu
        if orig_children:
            print(f'  Using {len(orig_children)} existing children from grammar.json')
            for child in orig_children:
                child_href = child['url'].replace(BASE, '')
                try:
                    child_soup, child_url = fetch(child_href)
                except Exception as e:
                    print(f'  ERROR: {e}')
                    continue
                time.sleep(DELAY)
                child_text = get_page_text(child_soup)
                sections_out.append({
                    'id': child['id'],
                    'title': child['title'],
                    'parentId': orig_sec['id'],
                    'url': child_url,
                    'explanation': child_text[:3000],
                    'words': extract_words(child_text),
                    'sentences': extract_sentences(child_text),
                    'relatedVideos': [],
                })
        else:
            # Scrape submenu subsections
            print(f'  Scraping {len(submenu)} subsections...')
            for sub_href, sub_title in submenu:
                sub_id = sub_href.replace('.htm', '')
                # Avoid duplicating top-level section itself
                if sub_id == orig_sec['id'] or sub_href == href:
                    continue
                # Skip if it's another top-level section
                if sub_id in orig_map and orig_map[sub_id].get('parentId') is None and sub_id != orig_sec['id']:
                    continue

                try:
                    sub_soup, sub_url = fetch(sub_href)
                except Exception as e:
                    print(f'  ERROR {sub_href}: {e}')
                    continue
                time.sleep(DELAY)

                sub_text = get_page_text(sub_soup)
                # Get title from page
                title_tag = sub_soup.find('title')
                title = sub_title
                if title_tag:
                    pt = title_tag.get_text(strip=True).split('|')[0].strip()
                    if pt:
                        title = pt

                sections_out.append({
                    'id': sub_id,
                    'title': title,
                    'parentId': orig_sec['id'],
                    'url': sub_url,
                    'explanation': sub_text[:3000],
                    'words': extract_words(sub_text),
                    'sentences': extract_sentences(sub_text),
                    'relatedVideos': [],
                })

    result = {'sections': sections_out}
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    total = len(sections_out)
    total_words = sum(len(s['words']) for s in sections_out)
    total_sents = sum(len(s['sentences']) for s in sections_out)
    print(f'\nDone: {total} sections, {total_words} words, {total_sents} sentences')
    print(f'Saved to {OUT_PATH}')

if __name__ == '__main__':
    main()
