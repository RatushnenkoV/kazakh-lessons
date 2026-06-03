import pdfplumber
import os

outdir = r'd:\Документы\Уроки казахского\pdf_images'
os.makedirs(outdir, exist_ok=True)

# Try extracting with pdfplumber
with pdfplumber.open(r'd:\Документы\Уроки казахского\1 урок\Урок 1.pdf') as pdf:
    # Key pages with exercise images
    key_pages = {
        12: 'colors_exercise',   # person images for colors
        14: 'numbers_exercise',  # pencils/bags
        15: 'fruits_exercise',   # fruits list + bag image
        16: 'fruits_exercise2',  # more fruits
    }
    for pi, page in enumerate(pdf.pages):
        pnum = pi + 1
        if pnum not in key_pages:
            continue
        label = key_pages[pnum]
        for ii, img_meta in enumerate(page.images):
            name = img_meta.get('name', f'img_{ii+1}')
            w = img_meta['width']
            h = img_meta['height']
            # Skip tiny images (decorative/icons)
            if w < 50 or h < 50:
                continue
            # Crop region from page
            x0 = img_meta['x0']
            y0 = img_meta['top']  # pdfplumber uses 'top' from top of page
            x1 = img_meta['x1']
            y1 = img_meta['bottom']
            crop = page.crop((x0, y0, x1, y1))
            im = crop.to_image(resolution=150)
            fname = f'p{pnum}_{label}_{name}.png'
            fpath = os.path.join(outdir, fname)
            im.save(fpath)
            print(f'Saved: {fname} ({w:.0f}x{h:.0f})')
