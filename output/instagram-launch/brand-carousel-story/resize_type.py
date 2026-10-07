from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np

ROOT = Path('/Users/manavdarooka/Desktop/friday-travel/output/instagram-launch/brand-carousel-story')
DEST = ROOT / 'smaller-type'
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

DEST.mkdir(exist_ok=True)

def text_layer(source, bounds, scale):
    x0, y0, x1, y1 = bounds
    crop = source.crop(bounds).convert('RGB')
    pixels = np.asarray(crop, dtype=np.float32)
    luminance = pixels.mean(axis=2)
    found = np.argwhere(luminance < 185)
    top, left = found.min(axis=0)
    bottom, right = found.max(axis=0) + 1
    pixels = pixels[top:bottom, left:right]
    luminance = luminance[top:bottom, left:right]
    opacity = np.clip((220 - luminance) * 255 / 205, 0, 255).astype('uint8')
    layer = Image.fromarray(np.dstack((np.zeros_like(opacity), np.zeros_like(opacity), np.zeros_like(opacity), opacity)), 'RGBA')
    size = (round(layer.width * scale), round(layer.height * scale))
    return layer.resize(size, Image.Resampling.LANCZOS)

thumbs = []
for i, art_name in enumerate(ART, 1):
    original = Image.open(ORIGINAL / f'slide-{i:02d}.png').convert('RGB')
    art = Image.open(GENERATED / art_name).convert('RGB').resize(original.size, Image.Resampling.LANCZOS)
    width, height = original.size

    # Extend the artwork's own ivory paper above the illustration to leave clear type space.
    sky = art.crop((0, 0, width, 460)).resize((width, 670), Image.Resampling.BICUBIC)
    paper = Image.new('RGB', original.size)
    paper.paste(sky, (0, 0))
    fade = Image.new('L', (1, height), 0)
    for y in range(height):
        fade.putpixel((0, y), 255 if y < 585 else max(0, round(255 * (675-y)/90)))
    base = Image.composite(paper, art, fade.resize(original.size))

    # Keep the supplied wordmark, position, size and counter at their original pixels.
    header_mask = Image.new('L', (1, height), 0)
    for y in range(height):
        header_mask.putpixel((0, y), 255 if y < 125 else max(0, round(255 * (180-y)/55)))
    base = Image.composite(original, base, header_mask.resize(original.size)).convert('RGBA')

    headline = text_layer(original, (55, 155, 1040, 500), 0.80)
    body_bottom = 660 if i == 5 else 615
    body = text_layer(original, (65, 505, 1030, body_bottom), 0.80)
    base.alpha_composite(headline, (70, 185))
    base.alpha_composite(body, (80, 475))

    if i == 6:
        button_mask = Image.new('L', original.size, 0)
        ImageDraw.Draw(button_mask).rounded_rectangle((76, 1081, 470, 1179), radius=49, fill=255)
        base = Image.composite(original.convert('RGBA'), base, button_mask)

    finished = base.convert('RGB')
    finished.save(DEST / f'slide-{i:02d}.png', optimize=True)
    thumbs.append(finished.resize((216, 270), Image.Resampling.LANCZOS))

sheet = Image.new('RGB', (216 * 3, 270 * 2), 'white')
for index, thumb in enumerate(thumbs):
    sheet.paste(thumb, ((index % 3) * 216, (index // 3) * 270))
sheet.save(DEST / 'preview.png', optimize=True)
