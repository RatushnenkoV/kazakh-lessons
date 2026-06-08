"""Fix corrupted titles for glv, modal, predl subsections by re-fetching page titles."""
import sys, json, time, requests
from bs4 import BeautifulSoup
sys.stdout.reconfigure(encoding='utf-8')

BASE = 'https://kaz-tili.kz/'

def fetch_title(url):
    r = requests.get(url, timeout=15)
    r.encoding = 'utf-8'
    soup = BeautifulSoup(r.text, 'lxml')
    t = soup.find('title')
    return t.get_text(strip=True).split('|')[0].strip() if t else ''

with open('kaz-content/grammar_full.json', encoding='utf-8') as f:
    data = json.load(f)

# Section IDs whose titles need fixing (nav titles were garbled)
fix_parents = {'glv', 'modal', 'predl_pr1', 'prichast'}

fixed = 0
for s in data['sections']:
    if s.get('parentId') in fix_parents:
        url = s['url']
        print(f'  {s["id"]}  {s["title"]!r}', end=' -> ')
        try:
            title = fetch_title(url)
            if title:
                s['title'] = title
                print(repr(title))
                fixed += 1
            else:
                print('(no title tag)')
        except Exception as e:
            print(f'ERROR: {e}')
        time.sleep(0.4)

print(f'\nFixed {fixed} titles.')

with open('kaz-content/grammar_full.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print('Saved.')
