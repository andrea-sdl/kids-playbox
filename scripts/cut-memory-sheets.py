"""Cut the 3x3 card sheets in art-src/ into single card images.

Finds each picture by its outline on the white background (the sheets'
grids are not perfectly even), then pads it to a square card image.
Needs ImageMagick 7 (`magick`). Order must match games/memory/themes.js.
Usage: python3 scripts/cut-memory-sheets.py
"""

import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src'
OUT = ROOT / 'games' / 'memory' / 'art'

SHEETS = [
    ('mem-animals-1.png', 'animals', ['lion', 'elephant', 'giraffe', 'zebra', 'panda', 'koala', 'kangaroo', 'tiger', 'monkey']),
    ('mem-animals-2.png', 'animals', ['penguin', 'polar-bear', 'fox', 'owl', 'rabbit', 'hedgehog', 'squirrel', 'deer', 'raccoon']),
    ('mem-animals-3.png', 'animals', ['dolphin', 'whale', 'octopus', 'sea-turtle', 'crab', 'flamingo', 'parrot', 'frog', 'butterfly']),
    ('mem-space-1.png', 'space', ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'phobos', 'deimos', 'ceres']),
    ('mem-space-2.png', 'space', ['jupiter', 'io', 'europa', 'ganymede', 'callisto', 'saturn', 'titan', 'enceladus', 'mimas']),
    ('mem-space-3.png', 'space', ['rhea', 'iapetus', 'uranus', 'miranda', 'titania', 'neptune', 'triton', 'pluto', 'charon']),
]


def find_boxes(sheet):
    """One bounding box (x, y, w, h) per grid cell, in reading order.

    Every shape centered inside a cell belongs to that cell's picture, even
    if it reaches past the cell's edge (e.g. Saturn's rings).
    """
    result = subprocess.run([
        'magick', str(sheet), '-colorspace', 'gray', '-threshold', '96%', '-negate',
        '-define', 'connected-components:verbose=true',
        '-define', 'connected-components:area-threshold=150',
        '-connected-components', '8', 'null:',
    ], capture_output=True, text=True, check=True)
    size = int(subprocess.run(['magick', 'identify', '-format', '%w', str(sheet)], capture_output=True, text=True, check=True).stdout)
    cell = size / 3
    boxes = [None] * 9
    for line in result.stdout.splitlines():
        match = re.match(r'\s*\d+: (\d+)x(\d+)\+(\d+)\+(\d+) ([\d.]+),([\d.]+) \S+ (\S+)', line)
        if not match or match.group(7) != 'gray(255)':
            continue  # skip the header and the background
        w, h, x, y = (int(v) for v in match.groups()[:4])
        cx, cy = float(match.group(5)), float(match.group(6))
        index = min(2, int(cy // cell)) * 3 + min(2, int(cx // cell))
        box = boxes[index]
        if box is None:
            boxes[index] = [x, y, x + w, y + h]
        else:
            boxes[index] = [min(box[0], x), min(box[1], y), max(box[2], x + w), max(box[3], y + h)]
    if any(box is None for box in boxes):
        raise SystemExit(f'{sheet.name}: an empty cell, expected 9 pictures')
    return [(b[0], b[1], b[2] - b[0], b[3] - b[1]) for b in boxes]


def cut(sheet_name, folder, names):
    sheet = SRC / sheet_name
    (OUT / folder).mkdir(parents=True, exist_ok=True)
    for name, (x, y, w, h) in zip(names, find_boxes(sheet)):
        side = int(max(w, h) * 1.1)
        subprocess.run([
            'magick', str(sheet), '-crop', f'{w}x{h}+{x}+{y}', '+repage',
            '-background', 'white', '-gravity', 'center', '-extent', f'{side}x{side}',
            '-resize', '256x256', '-quality', '80', str(OUT / folder / f'{name}.webp'),
        ], check=True)


for sheet_name, folder, names in SHEETS:
    cut(sheet_name, folder, names)
print('done')
