"""Refresh the pocket portfolio from the main portfolio. Python standard library only."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
import json, re

class Node:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []
    def text(self):
        return re.sub(r'\s+', ' ', ' '.join(c if isinstance(c, str) else c.text() for c in self.children)).strip()
    def all(self, tag=None, cls=None, id=None):
        found = []
        for c in self.children:
            if isinstance(c, Node):
                if (tag is None or c.tag == tag) and (cls is None or cls in c.attrs.get('class', '').split()) and (id is None or c.attrs.get('id') == id): found.append(c)
                found += c.all(tag, cls, id)
        return found
    def one(self, **kw):
        return next(iter(self.all(**kw)), Node())
class Parser(HTMLParser):
    def __init__(self, source):
        super().__init__(); self.root = Node(); self.stack = [self.root]; self.feed(source)
    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs); self.stack[-1].children.append(node)
        if tag not in ('area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'): self.stack.append(node)
    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1, 0, -1):
            if self.stack[i].tag == tag: self.stack = self.stack[:i]; break
    def handle_data(self, data): self.stack[-1].children.append(data)

root = Path(__file__).resolve().parent.parent
doc = Parser((root/'index.html').read_text()).root
url = lambda path: urljoin('https://manu.vision/', path)
links = lambda n: [dict(title=a.text().replace('↗','').replace('↓','').strip(), url=url(a.attrs['href'])) for a in n.all(tag='a')]
sections = []
def section(id, title, subtitle, items):
    sections.append(dict(id=id, title=title, subtitle=subtitle, items=items))
section('profile','Player profile','Art + technology + culture.', [dict(title='Manuel Sainsily', subtitle='Creative Director & Speaker', paragraphs=[n.text() for n in doc.one(cls='bio-prose').all(tag='p')], image='/images/2026/hero-manuel.jpg'), dict(title='Current role', subtitle='Adobe · Pro Design', paragraphs=['Sr. Creative Technologist', 'Prototyping next-generation creative workflows across AI and design systems.'])])
exhibitions=[]
for n in doc.all(cls='exhibition-card'):
    p=n.one(cls='exhibition-card__copy'); paragraphs=[e.text() for e in p.all(tag='p')][1:]
    paragraphs += [f"{d.one(tag='dt').text()}: {d.one(tag='dd').text()}" for d in p.one(tag='dl').all(tag='div')]
    exhibitions.append(dict(title=p.one(tag='h3').text(), subtitle=p.one(cls='eyebrow').text(), paragraphs=paragraphs, image='/'+n.one(tag='img').attrs['src'], links=[dict(title='View exhibition',url=n.attrs['href'])]))
section('exhibitions','Exhibitions','Immersive worlds people step into.',exhibitions)
lab=[]
for n in doc.all(cls='lab-card'):
    if n.tag!='a': continue
    image=n.one(tag='img').attrs.get('src') or n.one(tag='video').attrs.get('poster')
    item=dict(title=n.one(tag='strong').text(),subtitle=n.one(tag='small').text(),paragraphs=[n.one(tag='small').text()],links=[dict(title='Launch project',url=url(n.attrs['href']))])
    if image:item['image']='/'+image
    lab.append(item)
for n in doc.one(id='appsDialog').all(tag='a'):
    lab.append(dict(title=n.one(tag='strong').text(),subtitle=n.one(tag='small').text(), paragraphs=[n.one(cls='app-link-description').text().replace('↗','').strip()],image='/'+n.one(tag='img').attrs['src'],links=[dict(title='View on App Store',url=n.attrs['href'])]))
section('lab','The lab','Experiments, games & tactile ideas.',lab)
raw=re.search(r'const universityData = (\{.*?\n    \});', (root/'script.js').read_text(),re.S).group(1)
raw=re.sub(r'(\{|,)\s*([a-zA-Z]+):',r'\1"\2":',raw)
unis=json.loads(raw)
section('teaching','Teaching','University lectures & workshops.', [dict(title=n['name'],subtitle=n['date'],paragraphs=[n['description'],n['city']],links=[dict(title='View lecture',url=n['link'])]) for n in unis.values()])
section('impact','Impact','Human-centered global impact.',[dict(title=n.one(tag='dt').text(),subtitle=n.all(tag='dd')[0].text(),paragraphs=[x.text() for x in n.all(tag='dd')]) for n in doc.all(cls='metric')])
practice=[]
for id, title in [('educationDialog','Education'),('speakingDialog','Inspiration'),('immersiveDialog','Creative direction')]:
    n=doc.one(id=id)
    practice.append(dict(title=title,subtitle=n.one(tag='h2').text(),paragraphs=[n.one(cls='dialog-lede').text()]+[x.text() for x in n.all(tag='li')],links=links(n)))
section('practice','My practice','Three things I do. One point of view.',practice)
career=[]
for n in doc.one(cls='career-track').all(tag='li'):
    career.append(dict(title=n.one(tag='small').text(),subtitle=n.one(tag='time').text(),paragraphs=[n.one(tag='strong').text(),n.one(tag='p').text()],links=[dict(title='Explore role',url=n.one(tag='a').attrs['href'])]))
section('career','Career','One career. Many interfaces.',career)
section('partners','Partners & press','Trusted by industry leaders.',[dict(title='Clients & partners',subtitle='Creative collaborations',paragraphs=[n.attrs['alt'] for n in doc.one(cls='logo-grid').all(tag='img')]),dict(title='Featured in',subtitle='Press & publications',paragraphs=[n.attrs['alt'] for n in doc.one(id='pressGrid').all(tag='img')])])
section('testimonials','Kind words','What collaborators remember.',[dict(title=n.one(tag='strong').text(),subtitle=n.one(tag='span').text(),paragraphs=[n.one(tag='blockquote').text()]) for n in doc.all(cls='testimonial-card')])
section('contact','Connect','Let’s build the future together.',[dict(title='Say hello',subtitle='hello@manu.vision',paragraphs=['Let’s build the future together.'],links=[dict(title='Write an email',url='mailto:hello@manu.vision')]),dict(title='Find me online',subtitle='Keep in touch',paragraphs=['Art, technology, culture, and everything in between.'],links=links(doc.one(cls='contact-socials')) or [dict(title='LinkedIn',url='https://www.linkedin.com/in/manuvision'),dict(title='Instagram',url='https://www.instagram.com/manu.vision'),dict(title='All links',url='https://beacons.ai/manuvision')])])
(root/'gb/content.js').write_text('export const sections = '+json.dumps(sections,ensure_ascii=False,indent=2)+';\n')
print('Synced',len(sections),'sections;',sum(len(s['items']) for s in sections),'entries from portfolio source.')
