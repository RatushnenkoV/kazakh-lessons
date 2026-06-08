"""
Parse grammar.json from kaz-tili.kz into structured lesson data.
Extracts: explanation text, example sentences, word pairs, related video IDs.
Output: grammar_parsed.json
"""
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

RAW_PATH = 'kaz-content/grammar.json'
VIDEO_PATH = 'kaz-content/videocourse.json'
OUT_PATH = 'kaz-content/grammar_parsed.json'

KAZ_SPECIAL = set('әіңғүұқөһӘІҢҒҮҰҚӨҺ')

def has_kaz(s):
    return any(c in KAZ_SPECIAL for c in s)

# ── Video ID map: '04' → 'videosab04' ────────────────────────────────────────
video_raw = json.load(open(VIDEO_PATH, encoding='utf-8'))
video_map = {}
for v in video_raw['lessons']:
    m = re.match(r'(\d+)', v['title'])
    if m:
        video_map[m.group(1).zfill(2)] = v['id']

# ── Strip navigation junk ─────────────────────────────────────────────────────
def strip_navjunk(text):
    # Remove header up to author line
    m = re.search(r'Автор: Татьяна Валяева', text)
    if m:
        text = text[m.end():].strip()

    # Remove voice actor credits (e.g. 'Озвучила: Айдана Қойшығұл')
    text = re.sub(
        r'Озвучил[аиеы]?:?\s+[^\n]{0,120}?(?=[А-ЯӘІҢҒҮҰҚӨҺ][а-яәіңғүұқөһ])',
        '', text
    )

    # Extract 'По данной теме:' block before stripping footer
    m_related = re.search(r'По данной теме:(.*?)(?:Казахский язык|\Z)', text, re.DOTALL)
    related_raw = m_related.group(1).strip() if m_related else ''
    if m_related:
        text = text[:m_related.start()].strip()

    # Remove footer
    m = re.search(r'Казахский язык\. Просто о сложном', text)
    if m:
        text = text[:m.start()].strip()

    # Remove nav arrows and 'Наверх ↑'
    text = re.sub(r'Наверх ↑.*$', '', text, flags=re.DOTALL).strip()
    text = re.sub(r'<<[^>]{0,80}?>>', '', text).strip()

    return text.strip(), related_raw

# ── Extract related video IDs ─────────────────────────────────────────────────
def extract_videos(related_raw):
    nums = re.findall(r'Видео\.\s+(\d+)-', related_raw)
    return [video_map[n.zfill(2)] for n in nums if n.zfill(2) in video_map]

# ── Extract full example sentences (Kaz. – Ru.) ───────────────────────────────
def clean_kaz_sentence(kaz):
    """Strip Russian labels/explanations before the actual Kazakh sentence."""
    kaz = kaz.strip()
    # Strip label prefixes like '(Анықтауыш) ', '1) '
    kaz = re.sub(r'^\w+\)\s+', '', kaz)
    # If there's a colon, the kaz sentence likely starts after it
    # e.g. "Окончания 'йын/йін' присоединяются...: Мен тазалайын"
    if ':' in kaz:
        after_colon = kaz.rsplit(':', 1)[-1].strip()
        if after_colon and after_colon[0].isupper():
            kaz = after_colon
    # Strip leading non-sentence text up to first uppercase letter that follows a kaz-special char
    # e.g. "Примеры: Диванның" → strip "Примеры: "
    kaz = re.sub(r'^[^А-ЯӘІҢҒҮҰҚӨҺ]{0,60}([А-ЯӘІҢҒҮҰҚӨҺ])', r'\1', kaz)
    return kaz.strip()

def extract_sentences(text):
    # Pattern: uppercase kaz phrase, period, em-dash, russian phrase, period
    pattern = r'([А-ЯӘІҢҒҮҰҚӨҺ][^–\.]{6,}?)\. – ([^–\.]{5,150}?)\.'
    results = []
    seen = set()
    for kaz, ru in re.findall(pattern, text):
        kaz = clean_kaz_sentence(kaz)
        ru = ru.strip()

        # Quality: kaz must start with and have kazakh chars, ru must not
        if not has_kaz(kaz) or has_kaz(ru):
            continue
        # kaz must actually START with a kazakh-special char word (not Russian bleed)
        kaz_first_word = kaz.split()[0] if kaz.split() else ''
        if not has_kaz(kaz_first_word) and re.match(r'^[А-Яа-я]+$', kaz_first_word):
            # first word is plain cyrillic - could be Russian. Only keep if all-caps or known kaz
            if kaz_first_word[0].islower():
                continue
        if len(kaz) < 5 or len(ru) < 3:
            continue

        key = kaz[:30]
        if key not in seen:
            seen.add(key)
            results.append({'kaz': kaz, 'ru': ru})

    return results

# ── Strip Russian prefix from a kaz word ─────────────────────────────────────
def strip_ru_prefix(kaz):
    """If kaz starts with Russian text before first kaz-special-char word, strip it.
    e.g. 'зелёный көк' → 'көк', 'расстояние/ қарсысында' → 'қарсысында'
    """
    if not has_kaz(kaz):
        return kaz
    words = kaz.split()
    # Find first word containing a kaz-special char
    for i, w in enumerate(words):
        if has_kaz(w):
            return ' '.join(words[i:])
    return kaz

# ── Extract word / short-phrase pairs (kaz – ru) ──────────────────────────────
def extract_words(text):
    results = []
    seen = set()
    parts = text.split(' – ')

    for i in range(len(parts) - 1):
        left = parts[i]
        right = parts[i + 1]

        # kaz = last segment of left after comma / digit label / newline
        kaz_raw = re.split(r'[,\n]|\d+[\.\)]', left)[-1].strip()
        kaz_raw = re.sub(r'^[^А-ЯЁа-яА-Яа-яәіңғүұқөһА-Я]*', '', kaz_raw).strip()
        # Strip any Russian prefix words before the first kaz-special-char word
        kaz = strip_ru_prefix(kaz_raw)

        # ru = first segment of right before comma
        ru = re.split(r',', right)[0].strip()
        # Cut off at first kazakh-special-char word in ru
        ru_words = ru.split()
        ru_clean = []
        for w in ru_words:
            if has_kaz(w) and ru_clean:
                break
            ru_clean.append(w)
        ru = ' '.join(ru_clean).rstrip('.')

        # ── Quality filters ──
        if not kaz or not ru:
            continue
        if not has_kaz(kaz):           # kaz must have kazakh letters
            continue
        if has_kaz(ru):                # ru must not have kazakh letters
            continue
        if '+' in kaz or '+' in ru:   # skip morphology breakdowns
            continue
        if '.' in kaz:                 # skip sentence fragments
            continue
        # kaz first word must not look like a lowercase Russian word
        kaz_first = kaz.split()[0]
        if not has_kaz(kaz_first) and re.match(r'^[а-я]+$', kaz_first):
            continue
        if len(kaz.split()) > 4 or len(ru.split()) > 6:
            continue
        if len(kaz) < 2 or len(ru) < 2:
            continue
        if kaz in seen:
            continue

        seen.add(kaz)
        results.append({'kaz': kaz, 'ru': ru})

    return results

# ── Clean explanation (remove extracted sentences) ───────────────────────────
def clean_explanation(text, sentences):
    result = text
    for s in sentences:
        result = result.replace(s['kaz'] + '. – ' + s['ru'] + '.', '')
    # Normalize whitespace
    return ' '.join(result.split())

# ── Main ──────────────────────────────────────────────────────────────────────
raw = json.load(open(RAW_PATH, encoding='utf-8'))
output_sections = []

for s in raw['sections']:
    content, related_raw = strip_navjunk(s['fullText'])
    videos = extract_videos(related_raw)
    sentences = extract_sentences(content)
    words = extract_words(content)
    explanation = clean_explanation(content, sentences)

    output_sections.append({
        'id': s['id'],
        'title': s['title'],
        'parentId': s.get('parentId'),
        'url': s['url'],
        'explanation': explanation,
        'words': words,
        'sentences': sentences,
        'relatedVideos': videos,
    })

    print(f"{s['id']:15} words={len(words):3}  sentences={len(sentences):3}  videos={videos}")

result = {'sections': output_sections}
with open(OUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f'\nSaved to {OUT_PATH}')
total_w = sum(len(s['words']) for s in output_sections)
total_s = sum(len(s['sentences']) for s in output_sections)
print(f'Total: {total_w} word pairs, {total_s} example sentences across {len(output_sections)} sections')
