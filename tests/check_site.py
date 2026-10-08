"""Dependency-free focused static checks; not a browser/conformance test."""
from pathlib import Path
from urllib.parse import urlparse, unquote
from html.parser import HTMLParser
import json

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=[ROOT/'index.html',ROOT/'access/index.html',ROOT/'brief/index.html',ROOT/'privacy/index.html',ROOT/'404.html']
class Page(HTMLParser):
    def __init__(self,path):
        super().__init__(convert_charrefs=True)
        self.elements=[]
        self.feed(path.read_text())
    def handle_starttag(self,tag,attrs): self.elements.append((tag,dict(attrs)))
    def handle_startendtag(self,tag,attrs): self.handle_starttag(tag,attrs)
    def find(self,tag,**attrs):return [(t,a) for t,a in self.elements if t==tag and all(a.get(k)==v for k,v in attrs.items())]
errors=[]
for path in PUBLIC:
    page=Page(path)
    if len(page.find('h1'))!=1:errors.append(f'{path}: expected one H1')
    if not page.find('html',lang='en'):errors.append(f'{path}: missing language')
    ids=[a['id'] for _,a in page.elements if 'id' in a]
    if len(ids)!=len(set(ids)):errors.append(f'{path}: duplicate IDs')
    for tag,attrs in page.elements:
        references=[attrs[key] for key in ['src','href'] if key in attrs]
        if 'srcset' in attrs:references.extend(part.strip().split()[0] for part in attrs['srcset'].split(','))
        for value in references:
            parsed=urlparse(value)
            if parsed.scheme or value.startswith('//'):continue
            if value=='#':errors.append(f'{path}: dead # link')
            target=(ROOT/parsed.path.lstrip('/')) if parsed.path.startswith('/') else (path.parent/parsed.path)
            if not parsed.path:target=path
            if target.is_dir():target=target/'index.html'
            if not target.exists():errors.append(f'{path}: missing {value}')
            elif parsed.fragment and target.suffix=='.html':
                other=Page(target)
                if not any(a.get('id')==unquote(parsed.fragment) for _,a in other.elements) and parsed.fragment not in ['owner','customer']:errors.append(f'{path}: missing anchor {value}')
        if tag=='img':
            if 'alt' not in attrs:errors.append(f'{path}: missing image alt')
            if not all(x in attrs for x in ['width','height']):errors.append(f'{path}: missing image geometry')
        if tag=='a' and attrs.get('target')=='_blank' and not {'noopener','noreferrer'}.issubset(set(attrs.get('rel','').split())):errors.append(f'{path}: external link missing rel')
        if tag in ['textarea','select'] or (tag=='input' and attrs.get('type')!='checkbox'):
            if not attrs.get('id') or not page.find('label',**{'for':attrs.get('id')}):errors.append(f'{path}: unlabeled input')
    if path.parent.name in ['access','brief'] and not page.find('meta',name='robots',content='noindex,nofollow'):errors.append(f'{path}: missing noindex')
    for bad in ['vasmediaproductions.com','vasmedia.com','300%','50+','href="#"','form data-netlify']:
        if bad in path.read_text():errors.append(f'{path}: old or unsubstantiated value {bad}')
    if not page.find('link',rel='icon'):errors.append(f'{path}: missing favicon')
manifest=json.loads((ROOT/'site.webmanifest').read_text())
assert manifest['name']=='Vasquez Digital Solutions'
licenses=list((ROOT/'assets/fonts/licenses').glob('*.txt'))
assert len(licenses)==2,'Missing font licenses'
for p in licenses:
    if 'SIL OPEN FONT LICENSE' not in p.read_text():errors.append(f'{p}: invalid font license')
if errors:
    print('\n'.join(errors));raise SystemExit(1)
print(f'PASS: {len(PUBLIC)} pages; local references/anchors/srcsets, semantics, external rel, input labels, font licenses and legacy-claim checks.')
