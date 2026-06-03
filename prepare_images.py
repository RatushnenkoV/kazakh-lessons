import pdfplumber, shutil, os

src = r'd:\Документы\Уроки казахского\pdf_images'
dst = r'd:\Документы\Уроки казахского\img\lesson-1'
os.makedirs(dst, exist_ok=True)

# Rename existing extracted images
mapping = {
    'p12_colors_exercise_Image122.png': 'arman.png',
    'p12_colors_exercise_Image123.png': 'aizhan.png',
    'p12_colors_exercise_Image124.png': 'balalar.png',
    'p12_colors_exercise_Image125.png': 'samat.png',
    'p14_numbers_exercise_Image135.png': 'pencils.png',
    'p15_fruits_exercise_Image149.png':  'grapes.png',
    'p15_fruits_exercise_Image150.png':  'milk.png',
    'p16_fruits_exercise2_Image156.png': 'onion.png',
    'p16_fruits_exercise2_Image157.png': 'fish.png',
    'p16_fruits_exercise2_Image159.png': 'pear.png',
    'p16_fruits_exercise2_Image160.png': 'cucumber.png',
    'p16_fruits_exercise2_Image161.png': 'bread.png',
    'p16_fruits_exercise2_Image163.png': 'butter.png',
    'p16_fruits_exercise2_Image164.png': 'strawberry.png',
    'p16_fruits_exercise2_Image166.png': 'rice.png',
}

for src_file, dst_file in mapping.items():
    shutil.copy(os.path.join(src, src_file), os.path.join(dst, dst_file))
    print(f'Copied {dst_file}')

# Extract bags from page 15 as one combined image
with pdfplumber.open(r'd:\Документы\Уроки казахского\1 урок\Урок 1.pdf') as pdf:
    page = pdf.pages[14]  # page 15 (0-indexed)
    # Bags are in images Image139, Image140, Image141 - all at same row
    # Crop the region containing all 3 groups of bags
    imgs = [img for img in page.images if img['name'] in ('Image139','Image140','Image141')]
    if imgs:
        x0 = min(img['x0'] for img in imgs)
        x1 = max(img['x1'] for img in imgs)
        y0 = min(img['top'] for img in imgs)
        y1 = max(img['bottom'] for img in imgs)
        crop = page.crop((x0-4, y0-4, x1+4, y1+4))
        im = crop.to_image(resolution=180)
        bags_path = os.path.join(dst, 'bags.png')
        im.save(bags_path)
        print(f'Extracted bags.png ({x1-x0:.0f}x{y1-y0:.0f})')
    else:
        print('WARNING: bag images not found')

print('Done.')
