import pdfplumber

with pdfplumber.open(r'd:\Документы\Уроки казахского\1 урок\Урок 1.pdf') as pdf:
    for pi, page in enumerate(pdf.pages):
        annots = page.annots or []
        for a in annots:
            uri = a.get('uri') or (a.get('data') or {}).get('URI') or ''
            if uri:
                print(f'Page {pi+1}: {uri}')
        # Also try hyperlinks
        for h in (page.hyperlinks or []):
            print(f'Page {pi+1} hyperlink: {h}')
