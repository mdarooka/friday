from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path('/Users/manavdarooka/Desktop/friday-travel/output/instagram-launch/brand-carousel-story')
ORIGINAL = Path('/Users/manavdarooka/Desktop/friday-insta/468e646b-3859-40f4-be7c-0aa06d68d412-friday-brand-carousel')
GENERATED = Path('/Users/manavdarooka/.codex/generated_images/01a1159a-b10b-75b2-8b43-0adcaa400fee')
ART = [
    'exec-1dd12292-35bc-4c20-a50d-95d81f46cfe4.png',
    'exec-55e9e8e8-7255-4d01-89e3-3a5155d3ae24.png',
    'exec-b272a543-15f9-491a-8793-c0c4f8dd9b4b.png',
    'exec-0bae7e11-7c88-4dca-825e-ae640a7d62f5.png',
    'exec-2bf9b92a-39b7-4961-b07b-8afe069c2524.png',
    'exec-0964a9eb-c554-444a-87d0-4564e1b35064.png',
]

ROOT.mkdir(parents=True, exist_ok=True)
thumbs = []
for i, art_name in enumerate(ART, 1):
    original = Image.open(ORIGINAL / f'slide-{i:02d}.png').convert('RGB')
    artwork = Image.open(GENERATED / art_name).convert('RGB').resize(original.size, Image.Resampling.LANCZOS)
    width, height = original.size
    solid = 650 if i == 5 else 610
    fade_end = 675 if i == 5 else 650
    mask = Image.new('L', (1, height), 0)
    pixels = mask.load()
    for y in range(height):
        pixels[0, y] = 255 if y <= solid else max(0, round(255 * (fade_end - y) / (fade_end - solid)))
    mask = mask.resize((width, height))
    finished = Image.composite(original, artwork, mask)
    if i == 6:
        # The call-to-action is preserved from the supplied slide, including its exact lettering.
        button = Image.new('L', original.size, 0)
        draw = ImageDraw.Draw(button)
        draw.rounded_rectangle((76, 1081, 470, 1179), radius=49, fill=255)
        finished = Image.composite(original, finished, button)
    path = ROOT / f'slide-{i:02d}.png'
    finished.save(path, optimize=True)
    thumbs.append(finished.resize((216, 270), Image.Resampling.LANCZOS))

sheet = Image.new('RGB', (216 * 3, 270 * 2), 'white')
for index, thumb in enumerate(thumbs):
    sheet.paste(thumb, ((index % 3) * 216, (index // 3) * 270))
sheet.save(ROOT / 'preview.png', optimize=True)
