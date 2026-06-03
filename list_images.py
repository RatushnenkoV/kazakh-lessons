import pdfplumber, os

outdir = r'd:\Документы\Уроки казахского\pdf_images'
os.makedirs(outdir, exist_ok=True)

with pdfplumber.open(r'd:\Документы\Уроки казахского\1 урок\Урок 1.pdf') as pdf:
    for pi, page in enumerate(pdf.pages):
        for ii, img in enumerate(page.images):
            name = img.get('name', '?')
            x0 = img['x0']
            y0 = img['y0']
            w = img['width']
            h = img['height']
            print(f'Page {pi+1}, img {ii+1}: x0={x0:.0f}, y0={y0:.0f}, w={w:.0f}, h={h:.0f}, name={name}')
