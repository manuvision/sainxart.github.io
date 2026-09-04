import { sections } from './content.js';

const W = 480, H = 320;
const colors = { ink:'#f2f2d8', muted:'#a9add0', accent:'#d9f58b', bg:'#202443', line:'#46496c', selected:'#d9f58b' };
export class PortfolioScreen {
  constructor(onChange) {
    this.canvas=document.createElement('canvas'); this.canvas.width=W; this.canvas.height=H;
    this.ctx=this.canvas.getContext('2d'); this.onChange=onChange; this.images=new Map(); this.hits=[];
    this.state={view:'home',section:0,item:0,page:0,link:0}; this.history=[]; this.boot=true;
    this.loadImage('/images/2026/hero-manuel.jpg'); this.draw();
    document.fonts.load('24px Pixel').then(()=>this.draw());
  }
  get section(){return sections[this.state.section]}
  get item(){return this.section.items[this.state.item]}
  get label(){return this.state.view==='home'?this.section.title:this.state.view==='list'?this.item.title:this.state.view==='links'?this.item.links[this.state.link].title:this.item.title+' — page '+(this.state.page+1)+' of '+this.pageCount}
  rect(x,y,w,h,color){this.ctx.fillStyle=color;this.ctx.fillRect(x,y,w,h)}
  text(text,x,y,size=22,color=colors.ink){this.ctx.fillStyle=color;this.ctx.font=`${size}px Pixel, monospace`;this.ctx.textBaseline='top';this.ctx.fillText(text,x,y)}
  wrap(text,width,size=22){
    this.ctx.font=`${size}px Pixel, monospace`;
    const lines=[];let line='';
    for(const word of text.split(/\s+/)){const next=line?line+' '+word:word;if(this.ctx.measureText(next).width>width&&line){lines.push(line);line=word}else line=next}
    if(line)lines.push(line);return lines;
  }
  loadImage(src){
    if(!src||this.images.has(src))return;
    this.images.set(src,null);const img=new Image();
    img.onload=()=>{const c=document.createElement('canvas');c.width=96;c.height=96;const ctx=c.getContext('2d');const side=Math.min(img.width,img.height);ctx.drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,96,96);const data=ctx.getImageData(0,0,96,96);for(let i=0;i<data.data.length;i+=4){data.data[i]=Math.round(data.data[i]/42)*42;data.data[i+1]=Math.round(data.data[i+1]/42)*42;data.data[i+2]=Math.round(data.data[i+2]/42)*42}ctx.putImageData(data,0,0);this.images.set(src,c);this.draw()};img.src=src;
  }
  photo(src,x,y,w,h){this.loadImage(src);const img=this.images.get(src);if(img){this.ctx.imageSmoothingEnabled=false;this.ctx.drawImage(img,x,y,w,h)}else{this.rect(x,y,w,h,'#454365');for(let row=0;row<h;row+=8)for(let col=0;col<w;col+=8)if((row+col)%24===0)this.rect(x+col,y+row,8,8,'#565078')}}
  hit(x,y,w,h,action){this.hits.push({x,y,w,h,action})}
  touch(x,y){const hit=this.hits.find(h=>x>=h.x&&x<h.x+h.w&&y>=h.y&&y<h.y+h.h);if(hit){hit.action();return true}return false}
  push(view){this.history.push({...this.state});this.state.view=view;this.state.page=0;this.state.link=0;this.draw()}
  goHome(){this.history=[];this.state={view:'home',section:0,item:0,page:0,link:0};this.draw()}
  action(key){
    if(this.boot){this.boot=false;this.draw()}
    const s=this.state;
    if(key==='home'){this.goHome();return}
    if(key==='b'){if(this.history.length)this.state=this.history.pop();else s.view='home';this.draw();return}
    if(key==='a'){
      if(s.view==='home'){s.item=0;this.push('list')}
      else if(s.view==='list')this.push('detail');
      else if(s.view==='links')this.openLink(this.item.links[s.link].url);
      else if(this.item.links?.length===1)this.openLink(this.item.links[0].url);
      else if(this.item.links?.length>1)this.push('links');
      else this.action('right');
      return;
    }
    const delta=key==='up'||key==='left'?-1:1;
    if(s.view==='home')s.section=(s.section+delta+sections.length)%sections.length;
    else if(s.view==='list')s.item=(s.item+delta+this.section.items.length)%this.section.items.length;
    else if(s.view==='links')s.link=(s.link+delta+this.item.links.length)%this.item.links.length;
    else s.page=Math.max(0,Math.min(this.pageCount-1,s.page+delta));
    this.draw();
  }
  openLink(url){
    if(url.startsWith('mailto:'))window.location.href=url;
    else window.open(url,'_blank','noopener,noreferrer');
  }
  chrome(title,footer){
    this.rect(0,0,W,H,colors.bg);this.rect(0,0,W,31,'#171b35');this.text(title,16,7,17,colors.muted);
    this.rect(429,10,28,12,colors.accent);this.rect(457,13,4,6,colors.accent);this.rect(433,13,3,6,colors.bg);this.rect(442,13,3,6,colors.bg);this.rect(451,13,3,6,colors.bg);
    this.rect(0,291,W,29,'#171b35');this.text(footer,16,296,16,colors.muted);
    if(this.state.view!=='home'){this.hit(0,0,410,31,()=>this.action('b'));this.text('‹',4,6,18,colors.accent)}
  }
  draw(){
    this.hits=[];const s=this.state;
    if(this.boot){this.chrome('MANU.VISION / SP','ART + TECHNOLOGY + CULTURE');this.text('MANU',154,100,57,colors.ink);this.text('VISION',137,158,46,colors.accent);this.rect(150,222,180,4,colors.line);this.rect(150,222,122,4,colors.accent);this.changed();return}
    if(s.view==='home'){
      this.chrome('MANU.VISION / PORTFOLIO','↑↓ EXPLORE    A SELECT    '+String(s.section+1).padStart(2,'0')+'/10');
      this.text('SELECT YOUR WORLD',18,46,29);
      const start=Math.floor(s.section/4)*4;
      for(let i=start;i<Math.min(start+4,sections.length);i++){
        const y=93+(i-start)*46,selected=i===s.section;
        if(selected)this.rect(14,y-4,290,40,colors.selected);
        this.text(selected?'▶':String(i+1).padStart(2,'0'),24,y+4,19,selected?colors.bg:colors.muted);
        this.text(sections[i].title,54,y+2,23,selected?colors.bg:colors.ink);
        this.hit(14,y-4,290,40,()=>{s.section=i;this.action('a')});
      }
      this.photo('/images/2026/hero-manuel.jpg',323,89,140,123);
      this.rect(323,210,140,3,colors.accent);this.text('MANUEL',325,224,20);this.text('SAINSILY',325,244,20,colors.accent);
      this.text('◀',421,269,18,colors.muted);this.text('▶',450,269,18,colors.accent);
      this.hit(399,260,41,30,()=>this.action('up'));this.hit(440,260,40,30,()=>this.action('down'));
    }else if(s.view==='list'||s.view==='links'){
      const items=s.view==='links'?this.item.links:this.section.items;const index=s.view==='links'?s.link:s.item;
      this.chrome(this.section.title.toUpperCase(),'B BACK     A OPEN     '+(index+1)+'/'+items.length);
      this.text(s.view==='links'?'KEEP EXPLORING':this.section.title.toUpperCase(),18,46,29);
      this.text(s.view==='links'?'Opens in a new tab':this.section.subtitle,18,80,18,colors.muted);
      const start=Math.floor(index/4)*4;
      for(let i=start;i<Math.min(start+4,items.length);i++){
        const y=114+(i-start)*43,selected=i===index;
        if(selected)this.rect(14,y-3,449,38,colors.selected);
        const title=items[i].title;
        this.text(selected?'▶':'·',24,y+3,21,selected?colors.bg:colors.muted);
        const size=this.ctx.measureText(title).width>370?20:23;
        this.text(title,51,y+2,size,selected?colors.bg:colors.ink);
        this.hit(14,y-3,449,38,()=>{if(s.view==='links')s.link=i;else s.item=i;this.action('a')});
      }
    }else{
      const item=this.item,hasImage=!!item.image;
      const lines=item.paragraphs.flatMap((p,i)=>[...(i?['']:[]),...this.wrap(p,438,22)]);
      this.pageCount=Math.max(1,Math.ceil(lines.length/6));s.page=Math.min(s.page,this.pageCount-1);
      this.chrome(this.section.title.toUpperCase(),`B BACK    ← ${s.page+1}/${this.pageCount} →    ${item.links?.length?'A LINK ↗':'↓ READ'}`);
      const titleLines=this.wrap(item.title,hasImage?326:438,28).slice(0,2);
      titleLines.forEach((line,i)=>this.text(line,20,43+i*28,28,colors.accent));
      const subtitleLines=this.wrap(item.subtitle,hasImage?326:438,17).slice(0,2);
      subtitleLines.forEach((line,i)=>this.text(line,20,46+titleLines.length*28+i*18,17,colors.muted));
      if(hasImage)this.photo(item.image,363,43,96,76);
      this.rect(20,127,440,1,colors.line);
      lines.slice(s.page*6,(s.page+1)*6).forEach((line,i)=>this.text(line,20,136+i*25,22));
      this.hit(0,290,100,30,()=>this.action('b'));this.hit(100,290,75,30,()=>this.action('left'));this.hit(175,290,85,30,()=>this.action('right'));this.hit(260,290,220,30,()=>this.action('a'));
      this.hit(0,130,160,158,()=>this.action('left'));this.hit(160,130,320,158,()=>this.action('right'));
    }
    // A subtle LCD row structure; text stays crisp at the native screen resolution.
    for(let y=0;y<H;y+=3)this.rect(0,y,W,1,'rgba(10,16,35,.075)');
    this.changed();
  }
  changed(){this.onChange?.(this)}
}

export function fillReader(element){
  const title=document.createElement('h2');title.textContent='The full portfolio';element.append(title);
  const intro=document.createElement('p');intro.textContent='All the same worlds, with a little more room to read.';element.append(intro);
  for(const section of sections){
    const heading=document.createElement('h2');heading.textContent=section.title;element.append(heading);
    for(const item of section.items){const article=document.createElement('article');const h=document.createElement('h3');h.textContent=item.title;article.append(h);const sub=document.createElement('p');sub.className='subtitle';sub.textContent=item.subtitle;article.append(sub);for(const text of item.paragraphs){const p=document.createElement('p');p.textContent=text;article.append(p)}for(const link of item.links||[]){const a=document.createElement('a');a.textContent=link.title+' ↗';a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';article.append(a)}element.append(article)}
  }
}
