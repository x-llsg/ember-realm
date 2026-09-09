"""Build the OFL-licensed UI font from an upstream Noto Sans SC variable TTF.

Development-only: python -m pip install 'fonttools[woff]'
python scripts/subset-ui-font.py /path/to/NotoSansSC.ttf
The game and normal release builds use the committed WOFF2 directly.
"""
import hashlib
import json
import sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1])
codepoints = set(range(32, 127))
for folder in ('app', 'components', 'lib'):
    for path in (root / folder).rglob('*'):
        if path.suffix in ('.ts', '.tsx'):
            codepoints.update(map(ord, path.read_text(encoding='utf-8-sig')))
# Common Chinese typography and UI symbols may originate from browser controls.
codepoints.update(range(0x3000, 0x3040))
font = TTFont(source)
available = set(font.getBestCmap())
options = subset.Options()
options.flavor = 'woff2'
options.notdef_glyph = True
options.notdef_outline = True
options.recommended_glyphs = True
options.name_IDs = ['*']
options.name_legacy = True
options.name_languages = ['*']
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=sorted(codepoints & available))
subsetter.subset(font)
font.flavor = 'woff2'
destination = root / 'public/fonts/ember-ui.woff2'
font.save(destination)
metadata = {
    'family': 'Noto Sans SC',
    'source': 'https://github.com/google/fonts/tree/main/ofl/notosanssc',
    'license': 'SIL Open Font License 1.1; see OFL.txt',
    'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'subset': 'Characters in app, components and lib TypeScript sources, ASCII and Chinese punctuation; variable weight retained.',
    'codepoints': sorted(font.getBestCmap()),
    'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
}
(root / 'public/fonts/manifest.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'{len(metadata["codepoints"])} characters; {destination.stat().st_size} bytes')
