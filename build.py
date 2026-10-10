"""Build a dependency-free static distribution from an explicit public allowlist."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
DIST = ROOT / 'dist'
FILES = ['index.html', '404.html', 'access/index.html', 'brief/index.html', 'customer/index.html',
         'privacy/index.html', 'favicon.svg', 'site.webmanifest', 'robots.txt',
         'sitemap.xml', '_headers']
if DIST.exists():
    shutil.rmtree(DIST)
DIST.mkdir()
for name in FILES:
    target = DIST / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / name, target)
for source in (ROOT / 'assets').rglob('*'):
    if source.is_file() and source.suffix in {'.css', '.js', '.woff', '.webp', '.avif', '.jpg', '.txt'}:
        if source.name in {'customer-wizard.js', 'customer-template.js'}:
            continue  # Synthetic fixture scripts are never published.
        target = DIST / source.relative_to(ROOT)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
files = [p for p in DIST.rglob('*') if p.is_file()]
print(f'Built {len(files)} files, {sum(p.stat().st_size for p in files):,} bytes in dist/')
