// Every mark on the LCD is drawn on an integer pixel. No browser fonts or images.
const INK = ['#aec879', '#839e55', '#536d39', '#283e29'];
const FONT = {
  A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',
  E:'111100110100111',F:'111100110100100',G:'011100101101011',H:'101101111101101',
  I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',
  M:'101111111101101',N:'101111111111101',O:'010101101101010',P:'110101110100100',
  Q:'010101101111011',R:'110101110101101',S:'011100010001110',T:'111010010010010',
  U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',
  Y:'101101010010010',Z:'111001010100111',
  0:'111101101101111',1:'010110010010111',2:'110001010100111',3:'110001010001110',
  4:'101101111001001',5:'111100110001110',6:'011100111101111',7:'111001010010010',
  8:'111101111101111',9:'111101111001110',
  '.':'000000000000010',':':'000010000010000',',':'000000000010100',
  '!':'010010010000010','?':'110001010000010','-':'000000111000000',
  '+':'000010111010000','/':'001001010100100','%':'101001010100101',
  '<':'001010100010001','>':'100010001010100',"'":'010010000000000',
  '=':'000111000111000','(':'001010010010001',')':'100010010010100',
  '*':'000101010101000','_':'000000000000111',' ':'000000000000000',
};

const ICONS = {
  food:['0001000','0011100','0001000','0000000','1111111','0111110','0011100'],
  bath:['0010010','0100100','0010010','0000000','1000001','1111111','0111110'],
  play:['0111110','1101011','1110111','1101011','1111111','0100010','0000000'],
  stats:['0100100','1111110','1111110','0111100','0011000','0000000','0000000'],
  lights:['0011100','0111110','0111110','0011100','0011100','0000000','0011100'],
  medicine:['0011100','0011100','1111111','1111111','1111111','0011100','0011100'],
  heart:['0110110','1111111','1111111','0111110','0011100','0001000','0000000'],
  star:['0001000','0011100','1111111','0111110','0111110','1100011','1000001'],
  coin:['0011100','0111110','1110111','1101011','1110111','0111110','0011100'],
  poop:['0001000','0011100','0001100','0011110','0111110','1111111','0111110'],
};
const CARE = ['food', 'bath', 'play', 'stats', 'lights', 'medicine'];
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

export class LCDRenderer {
  constructor(canvas) {
    this.canvas = canvas || document.createElement('canvas');
    this.canvas.width = 160;
    this.canvas.height = 144;
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.t = 0;
  }

  rect(x, y, w, h, shade = 3) {
    this.ctx.fillStyle = INK[shade] || shade;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  box(x, y, w, h, shade = 3, thickness = 1) {
    this.rect(x, y, w, thickness, shade);
    this.rect(x, y + h - thickness, w, thickness, shade);
    this.rect(x, y, thickness, h, shade);
    this.rect(x + w - thickness, y, thickness, h, shade);
  }

  line(x1, y1, x2, y2, shade = 3) {
    let x = Math.round(x1), y = Math.round(y1);
    const tx = Math.round(x2), ty = Math.round(y2);
    const dx = Math.abs(tx - x), dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1, sy = y < ty ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      this.rect(x, y, 1, 1, shade);
      if (x === tx && y === ty) break;
      const e2 = 2 * error;
      if (e2 >= dy) { error += dy; x += sx; }
      if (e2 <= dx) { error += dx; y += sy; }
    }
  }

  text(value, x, y, shade = 3, scale = 1, align = 'left', maxChars = 40) {
    const str = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().slice(0, maxChars);
    const width = Math.max(0, str.length * 4 - 1) * scale;
    let left = align === 'center' ? Math.round(x - width / 2) : align === 'right' ? x - width : x;
    for (const letter of str) {
      const glyph = FONT[letter] || FONT['?'];
      for (let p = 0; p < 15; p++) if (glyph[p] === '1') {
        this.rect(left + (p % 3) * scale, y + Math.floor(p / 3) * scale, scale, scale, shade);
      }
      left += 4 * scale;
    }
  }

  sprite(rows, x, y, scale = 1, shade = 3) {
    rows.forEach((row, sy) => {
      for (let sx = 0; sx < row.length; sx++) {
        if (row[sx] !== '0' && row[sx] !== ' ') this.rect(x + sx * scale, y + sy * scale, scale, scale, shade);
      }
    });
  }

  icon(name, x, y, scale = 1, shade = 3) {
    this.sprite(ICONS[name] || ICONS.star, x, y, scale, shade);
  }

  title(title, sub = '') {
    this.text(title, 80, 27, 3, 1, 'center', 34);
    if (sub) this.text(sub, 80, 37, 2, 1, 'center', 35);
  }

  footer(hint = 'A SELECT   B OK   C BACK') {
    this.rect(7, 126, 146, 1, 2);
    this.text(hint, 80, 134, 3, 1, 'center', 37);
  }

  nav(snapshot) {
    const menu = snapshot.menu || {};
    const selected = snapshot.mode === 'menu' ? (menu.selected || 0) : -1;
    for (let i = 0; i < CARE.length; i++) {
      const x = 15 + i * 24;
      if (i === selected) this.rect(x - 5, 3, 17, 14, 3);
      const shade = i === selected ? 0 : 2;
      this.icon(CARE[i], x, 7, 1, shade);
      const pet = snapshot.pet || {};
      const alert = (i === 0 && pet.hunger < 25) || (i === 1 && snapshot.poop > 0) || (i === 5 && pet.health < 45);
      if (alert && Math.floor(this.t * 2) % 2) this.rect(x + 9, 5, 2, 2, 3);
    }
    this.rect(7, 20, 146, 1, 2);
  }

  draw(snapshot = {}, elapsedSeconds = 0) {
    this.t = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
    this.rect(0, 0, 160, 144, 0);
    this.nav(snapshot);
    const mode = snapshot.mode || 'home';
    if (mode === 'stats') this.stats(snapshot);
    else if (mode === 'food') this.foodMenu(snapshot);
    else if (mode === 'gameSelect') this.gameMenu(snapshot);
    else if (mode === 'menu') this.careMenu(snapshot);
    else if (mode === 'catch') this.catchGame(snapshot);
    else if (mode === 'memory') this.memoryGame(snapshot);
    else if (snapshot.stage === 'egg' || mode === 'hatching') this.eggScene(snapshot);
    else this.home(snapshot);
    // The grain is anchored to LCD pixels, so the display remains perfectly still.
    // It is intentionally very sparse; the physical glass supplies the visible grid.
    this.rect(1, 1, 1, 142, 1);
    this.rect(158, 1, 1, 142, 1);
  }

  egg(x, y, progress = 0, scale = 2) {
    const rows = [
      '000001111100000','000111111111000','001111111111100','001111111111100',
      '011111111111110','011111111111110','111111111111111','111111111111111',
      '111111111111111','111111111111111','111111111111111','111111111111111',
      '011111111111110','011111111111110','001111111111100','000111111111000',
    ];
    rows.forEach((row, j) => [...row].forEach((v, i) => {
      if (v === '0') return;
      const edge = !rows[j - 1] || !rows[j + 1] || row[i - 1] !== '1' || row[i + 1] !== '1' || rows[j - 1][i] !== '1' || rows[j + 1][i] !== '1';
      this.rect(x + i * scale, y + j * scale, scale, scale, edge ? 3 : 0);
    }));
    this.sprite(['0110','1111','0110'], x + 3 * scale, y + 4 * scale, scale, 2);
    this.sprite(['110','111','010'], x + 9 * scale, y + 9 * scale, scale, 2);
    this.rect(x + 4 * scale, y + 12 * scale, 2 * scale, 2 * scale, 1);
    this.rect(x + 10 * scale, y + 3 * scale, scale, 2 * scale, 1);
    if (progress > 0.15) {
      const crack = [[8, 0],[7, 2],[9, 4],[7, 6],[8, 8],[6, 10],[8, 12],[7, 15]];
      const count = Math.min(crack.length - 1, Math.ceil(progress * (crack.length - 1)));
      for (let i = 0; i < count; i++) this.line(x + crack[i][0] * scale, y + crack[i][1] * scale, x + crack[i + 1][0] * scale, y + crack[i + 1][1] * scale, 3);
    }
  }

  sparkle(x, y, size = 2, shade = 2) {
    this.rect(x, y - size, 1, size * 2 + 1, shade);
    this.rect(x - size, y, size * 2 + 1, 1, shade);
  }

  eggScene(s) {
    const hatching = s.mode === 'hatching' || (s.hatch?.progress > 0);
    const progress = clamp(s.hatch?.progress, 0, 1);
    this.title(hatching ? 'SOMETHING IS STIRRING...' : 'A LITTLE BEGINNING');
    this.text(hatching ? 'HELLO IN THERE!' : 'YOUR NEW FRIEND IS WAITING', 80, 39, 2, 1, 'center');
    const wobble = hatching ? Math.round(Math.sin(this.t * (9 + progress * 22)) * (1 + progress * 3)) : Math.round(Math.sin(this.t * 2) * 1);
    const y = 67 - (hatching && progress > 0.7 ? Math.floor(Math.sin(this.t * 15) * 2) : 0);
    this.rect(58, 103, 44, 2, 1);
    this.rect(62, 105, 36, 1, 1);
    this.egg(65 + wobble, y, progress);
    this.sparkle(37, 64 + Math.floor(Math.sin(this.t) * 2), 3);
    this.sparkle(119, 78 - Math.floor(Math.sin(this.t) * 2), 3);
    this.sparkle(44, 91, 1, 1);
    this.sparkle(108, 51, 1, 1);
    if (hatching) {
      this.box(47, 115, 66, 5, 2);
      this.rect(49, 117, Math.round(progress * 62), 1, 3);
      if (progress > 0.55) {
        this.line(53, 77, 49, 71, 2);
        this.line(107, 76, 112, 70, 2);
      }
      this.footer('A TINY WORLD IS WAKING UP');
    } else {
      this.text('PRESS B TO HATCH', 80, 115, 3, 1, 'center');
      this.footer('A LITTLE CARE. A LOT OF LOVE.');
    }
  }

  room(s) {
    const sleeping = s.pet?.sleeping;
    this.rect(10, 108, 140, 1, 2);
    this.rect(10, 109, 140, 7, 1);
    for (let x = 16; x < 150; x += 19) this.rect(x, 113, 6, 1, 2);
    // A tiny window and a two-leaf plant make the room feel inhabited.
    this.box(118, 44, 25, 24, 2);
    this.box(120, 46, 21, 20, 1);
    this.rect(130, 44, 1, 24, 2);
    this.rect(118, 55, 25, 1, 2);
    this.rect(116, 69, 29, 2, 2);
    if (sleeping) {
      this.sprite(['01110','11100','11000','11100','01110'], 123, 48, 1, 3);
      this.rect(135, 50, 1, 1, 3);
      this.rect(137, 60, 1, 1, 3);
    } else {
      this.rect(123, 48, 3, 3, 2);
      this.rect(134, 60, 6, 1, 1);
      this.rect(136, 59, 3, 1, 1);
    }
    this.rect(21, 87, 1, 13, 2);
    this.sprite(['1100000','1110011','0111110','0011100'], 17, 84, 1, 2);
    this.rect(15, 97, 14, 3, 2);
    this.rect(17, 100, 10, 6, 2);
    this.rect(19, 101, 2, 3, 1);
    if (!sleeping) {
      this.rect(40, 46, 1, 1, 1);
      this.rect(107, 96, 1, 1, 1);
    }
  }

  pet(x, baseline, stage = 'baby', options = {}) {
    const scale = options.scale || 2;
    const sleepy = !!options.sleeping;
    const sad = !!options.sad;
    const happy = !!options.happy;
    const eating = !!options.eating;
    const blink = sleepy || (!eating && Math.floor(this.t * 2.2) % 13 === 0);
    const child = stage === 'child' || stage === 'adult';
    const adult = stage === 'adult';
    const rows = child ? [
      '000001100001100000','000011110011110000','000011111111110000',
      '000111111111111000','001111111111111100','011111111111111110',
      '011111111111111110','111111111111111111','111111111111111111',
      '111111111111111111','111111111111111111','111111111111111111',
      '111111111111111111','011111111111111110','011111111111111110',
      '001111111111111100','000111111111111000','000111100011110000',
    ] : [
      '0000011111100000','0001111111111000','0011111111111100','0111111111111110',
      '0111111111111110','1111111111111111','1111111111111111','1111111111111111',
      '1111111111111111','1111111111111111','0111111111111110','0111111111111110',
      '0011111111111100','0001111111111000','0011110000111100',
    ];
    const width = rows[0].length;
    const left = Math.round(x - width * scale / 2);
    const top = Math.round(baseline - rows.length * scale);
    // Draw a one-pixel outline and discrete stipple shadows inside the silhouette.
    rows.forEach((row, j) => [...row].forEach((v, i) => {
      if (v === '0') return;
      const edge = !rows[j - 1] || !rows[j + 1] || row[i - 1] !== '1' || row[i + 1] !== '1' || rows[j - 1][i] !== '1' || rows[j + 1][i] !== '1';
      const shade = edge ? 3 : (i > width - 4 || j > rows.length - 4) ? 1 : 0;
      this.rect(left + i * scale, top + j * scale, scale, scale, shade);
    }));
    const faceY = top + (child ? 8 : 6) * scale;
    const eyeLeft = left + (child ? 5 : 4) * scale;
    const eyeRight = left + (child ? 11 : 10) * scale;
    const eyeH = blink ? 1 : 3;
    if (happy && !blink) {
      this.sprite(['010','101'], eyeLeft - scale, faceY, scale);
      this.sprite(['010','101'], eyeRight - scale, faceY, scale);
    } else {
      this.rect(eyeLeft, faceY + (blink ? scale : 0), scale, eyeH * scale, 3);
      this.rect(eyeRight, faceY + (blink ? scale : 0), scale, eyeH * scale, 3);
      if (blink) {
        this.rect(eyeLeft - scale, faceY + scale, 3 * scale, scale, 3);
        this.rect(eyeRight - scale, faceY + scale, 3 * scale, scale, 3);
      }
    }
    const mouthX = left + (child ? 8 : 7) * scale;
    if (eating) this.rect(mouthX - scale, faceY + 4 * scale, 3 * scale, 2 * scale, 3);
    else if (sad) this.sprite(['010','101'], mouthX - scale, faceY + 4 * scale, scale);
    else this.sprite(['101','010'], mouthX - scale, faceY + 4 * scale, scale);
    this.rect(eyeLeft - 2 * scale, faceY + 3 * scale, 2 * scale, scale, 1);
    this.rect(eyeRight + scale, faceY + 3 * scale, 2 * scale, scale, 1);
    if (adult) {
      // Adult sprouts a distinctive little crown of leaves.
      this.sprite(['10001','11011','01110','00100'], x - 5 * scale / 2, top - 4 * scale, scale, 3);
      this.rect(left - 2 * scale, top + 11 * scale, 3 * scale, 2 * scale, 3);
      this.rect(left + width * scale - scale, top + 11 * scale, 3 * scale, 2 * scale, 3);
    }
    return { left, top, width: width * scale, height: rows.length * scale };
  }

  home(s) {
    const p = s.pet || {};
    const name = p.name || 'MOMO';
    this.text(name, 10, 28, 3, 1, 'left', 15);
    this.text(p.sleeping ? 'ZZZ...' : (s.stage || 'BABY'), 149, 28, 2, 1, 'right');
    this.room(s);
    const effect = s.effect?.type || '';
    const eating = /eat|feed|meal|snack|food/.test(effect);
    const bath = /clean|bath/.test(effect);
    const heal = /heal|medicine/.test(effect);
    const happy = /happy|love|pet|play|grow|hatch|eat|feed|meal|snack/.test(effect) || p.happiness > 80;
    const sad = p.hunger < 25 || p.happiness < 25 || p.health < 45;
    const hop = p.sleeping ? 0 : Math.max(0, Math.round(Math.sin(this.t * (happy ? 4 : 2.4)) * (happy ? 4 : 2)));
    this.rect(61, 105, 38, 3, 1);
    const body = this.pet(80 + (eating ? -4 : 0), 106 - hop, s.stage, { sleeping: p.sleeping, sad, happy: happy && !sad, eating: eating && Math.floor(this.t * 5) % 2 === 0 });
    for (let i = 0; i < Math.min(Number(s.poop) || 0, 3); i++) this.icon('poop', 105 + (i % 2) * 14, 101 - Math.floor(i / 2) * 9, 1, 3);
    if (p.sleeping) {
      this.text('Z', 105, 72 - Math.floor(this.t % 2) * 4, 3, 2);
      this.text('Z', 119, 57 - Math.floor(this.t % 2) * 3, 2);
      this.rect(body.left - 2, 91, body.width + 4, 12, 2);
      this.rect(body.left, 93, body.width, 2, 1);
      for (let x = body.left + 2; x < body.left + body.width; x += 8) this.rect(x, 98, 3, 2, 1);
    } else if (eating) {
      this.foodSprite(s.effect?.food === 'snack' ? 'snack' : 'meal', 112, 83, 1);
      this.rect(96, 90, 2, 2, 2);
      this.rect(101, 94, 2, 2, 2);
      this.icon('heart', 49, 51 - Math.floor(this.t * 3) % 5, 1, 3);
    } else if (bath) {
      this.rect(51, 97, 59, 3, 3);
      this.rect(54, 100, 53, 7, 2);
      this.rect(57, 107, 47, 2, 3);
      for (let i = 0; i < 7; i++) {
        const y = 89 - ((Math.floor(this.t * 12) + i * 9) % 37);
        this.box(48 + (i * 13) % 64, y, i % 2 ? 4 : 6, i % 2 ? 4 : 6, 2);
      }
      this.sparkle(44, 67, 2, 3);
      this.sparkle(106, 75, 2, 3);
    } else if (heal) {
      this.icon('medicine', 45, 50 + Math.floor(Math.sin(this.t * 3) * 2), 1, 3);
      this.icon('heart', 101, 61 - Math.floor(this.t * 4) % 10, 1, 2);
    } else if (sad) {
      this.box(49, 46, 16, 11, 2);
      this.text(p.health < 45 ? '+' : p.hunger < 25 ? '!' : '...', 57, 49, 3, 1, 'center');
      this.rect(62, 57, 2, 3, 2);
    } else if (Math.floor(this.t) % 12 < 3) {
      this.icon('heart', 54, 49 - Math.floor(this.t % 3), 1, 2);
    }
    const msg = this.message(s);
    if (msg) this.text(msg, 80, 118, 3, 1, 'center', 36);
    else {
      this.miniMeter('FOOD', p.hunger, 10, 118);
      this.miniMeter('JOY', p.happiness, 61, 118);
      this.miniMeter('REST', p.energy, 108, 118);
    }
    this.footer(p.sleeping ? 'A CARE   B DREAM   C STATS' : 'A CARE   B PET   C STATS');
  }

  message(s) {
    return typeof s.message === 'string' ? s.message : s.message?.text || '';
  }

  miniMeter(label, value, x, y) {
    this.text(label, x, y, 2);
    const start = x + label.length * 4 + 3;
    for (let i = 0; i < 4; i++) this.rect(start + i * 4, y, 3, 5, (value ?? 80) > i * 25 ? 3 : 1);
  }

  careMenu(s) {
    this.title(s.menu?.title || 'CARE');
    const items = s.menu?.items || CARE.map(id => ({ id, label: id }));
    const selected = s.menu?.selected || 0;
    items.slice(0, 6).forEach((item, i) => {
      const y = 38 + i * 14;
      const current = i === selected;
      if (current) {
        this.rect(11, y - 3, 138, 12, 3);
        this.text('>', 137, y, 0);
      }
      this.icon(CARE[i], 18, y - 1, 1, current ? 0 : 2);
      this.text(item.label || item.id || item, 35, y, current ? 0 : 3, 1, 'left', 23);
    });
    this.footer(this.message(s) || 'A NEXT   B CHOOSE   C BACK');
  }

  foodSprite(type, x, y, scale = 1) {
    if (type === 'snack') {
      this.sprite(['000111000','000110000','001111100','011111110','111111111','111111111','111111111','011111110','001111100'], x - 9 * scale / 2, y - 4 * scale, scale, 3);
      this.rect(x - 2 * scale, y - scale, scale, 2 * scale, 0);
      this.rect(x + 3 * scale, y + 2 * scale, scale, scale, 1);
    } else {
      this.sprite(['0000011100000','0001111111000','0011111111100','0111111111110','1111111111111','0000000000000','1111111111111','0111111111110','0111111111110','0011111111100','0001111111000'], x - 13 * scale / 2, y - 5 * scale, scale, 3);
      this.rect(x - 3 * scale, y - 2 * scale, scale, scale, 0);
      this.rect(x + 2 * scale, y - 3 * scale, scale, scale, 0);
      this.rect(x - 4 * scale, y + 3 * scale, 8 * scale, scale, 1);
    }
  }

  foodMenu(s) {
    this.title('THE LITTLE KITCHEN', 'A HAPPY TUMMY, A HAPPY PET');
    const selected = s.menu?.selected || 0;
    ['MEAL', 'SNACK'].forEach((label, i) => {
      const x = 14 + i * 70;
      this.box(x, 51, 62, 51, selected === i ? 3 : 1, selected === i ? 2 : 1);
      this.foodSprite(i ? 'snack' : 'meal', x + 31, 74, 2);
      this.text(label, x + 31, 91, 3, 1, 'center');
      if (selected === i) this.text('>', x + 6, 91);
    });
    this.text(selected === 0 ? 'RICE BOWL: +FOOD / FREE' : 'APPLE: +JOY / 2 COINS', 80, 112, 3, 1, 'center');
    this.footer(this.message(s) || 'A NEXT   B FEED   C BACK');
  }

  gameMenu(s) {
    this.title('PLAY A LITTLE', 'GOOD TIMES GROW FRIENDSHIPS');
    const selected = s.menu?.selected || 0;
    ['CATCH', 'MEMORY'].forEach((label, i) => {
      const x = 14 + i * 70;
      this.box(x, 51, 62, 51, selected === i ? 3 : 1, selected === i ? 2 : 1);
      if (i === 0) {
        this.icon('star', x + 27, 59, 1, 3);
        this.sprite(['100000001','110000011','011111110','001111100'], x + 22, 74, 2, 3);
      } else {
        for (let n = 0; n < 3; n++) {
          this.box(x + 9 + n * 15, 66, 12, 15, 3);
          this.text('ABC'[n], x + 13 + n * 15, 71, 3);
        }
      }
      this.text(label, x + 31, 91, 3, 1, 'center');
      if (selected === i) this.text('>', x + 6, 91);
    });
    this.text(selected === 0 ? 'CATCH FOOD. DODGE THE MESS.' : 'WATCH. REMEMBER. REPEAT.', 80, 112, 3, 1, 'center');
    this.footer('A NEXT   B PLAY   C BACK');
  }

  stats(s) {
    const p = s.pet || {};
    this.title(`${p.name || 'MOMO'}'S LITTLE WORLD`);
    const stats = [['FOOD', p.hunger], ['JOY', p.happiness], ['CLEAN', p.cleanliness], ['ENERGY', p.energy], ['HEALTH', p.health]];
    stats.forEach(([label, value], i) => {
      const y = 41 + i * 13;
      this.text(label, 12, y, 3);
      this.box(44, y - 1, 76, 7, 2);
      const fill = Math.round(clamp(value, 0, 100) / 100 * 72);
      this.rect(46, y + 1, fill, 3, 3);
      for (let k = 0; k < 6; k++) this.rect(46 + k * 12, y + 1, 1, 3, 0);
      this.text(Math.round(clamp(value, 0, 100)), 147, y, 3, 1, 'right');
    });
    const ageMs = Number(p.ageMs) || 0;
    const mins = Math.floor(ageMs / 60000);
    const age = mins < 60 ? `${mins} MIN` : mins < 1440 ? `${Math.floor(mins / 60)}H ${mins % 60}M` : `${Math.floor(mins / 1440)} DAYS`;
    this.text(`${s.stage || 'BABY'} / ${age}`, 12, 111, 2);
    this.icon('coin', 117, 109, 1, 2);
    this.text(s.coins || 0, 147, 111, 3, 1, 'right');
    this.footer('A CARE   B HOME   C BACK');
  }

  catchGame(s) {
    const game = s.catch || {};
    const laneX = [32, 80, 128];
    if (game.active) {
      this.text('CATCH!', 9, 27, 3);
      this.text(String(game.score || 0).padStart(2, '0'), 75, 27, 3, 1, 'right');
      for (let i = 0; i < 3; i++) this.icon('heart', 118 + i * 10, 25, 1, i < (game.lives ?? 3) ? 3 : 1);
      for (let lane = 0; lane < 3; lane++) {
        for (let y = 39; y < 100; y += 8) this.rect(laneX[lane], y, 1, 2, 1);
      }
      for (const item of game.objects || []) {
        const x = laneX[clamp(item.lane, 0, 2)];
        const y = Math.round(38 + clamp(item.y, 0, 1) * 65);
        if (item.kind === 'bad' || item.kind === 'poop') this.icon('poop', x - 3, y, 1, 3);
        else this.foodSprite('snack', x, y + 3, 1);
      }
      for (let lane = 0; lane < 3; lane++) {
        const x = laneX[lane];
        if (lane === (game.lane ?? 1)) {
          this.sprite(['10000000001','11000000011','01111111110','00111111100'], x - 11, 102, 2, 3);
          this.rect(x - 6, 108, 12, 1, 1);
        } else this.rect(x - 10, 110, 20, 1, 1);
        this.text(lane === 0 ? '< A' : lane === 1 ? 'B' : 'C >', x, 117, 3, 1, 'center');
      }
      this.footer(`CATCH THE APPLES! ${Math.ceil(game.remaining || 0)}S`);
    } else {
      const result = game.score > 0 || game.lives === 0 || game.result;
      this.title(result ? 'NICE CATCH!' : 'SNACK ATTACK');
      this.foodSprite('snack', 49, 68, 2);
      this.icon('poop', 105, 62, 2, 3);
      this.text('+1', 49, 85, 3, 1, 'center');
      this.text('DODGE', 111, 85, 3, 1, 'center');
      this.text(result ? `SCORE ${game.score || 0}  BEST ${s.highScores?.catch || 0}` : 'A LEFT  B MIDDLE  C RIGHT', 80, 103, 3, 1, 'center');
      this.text(result ? game.result || 'ONE MORE ROUND?' : 'THREE LANES. TINY REFLEXES.', 80, 114, 2, 1, 'center');
      this.footer('B START   C BACK');
    }
  }

  memoryGame(s) {
    const game = s.memory || {};
    const phase = game.phase || 'ready';
    this.title('LITTLE ECHO', phase === 'ready' ? 'A MEMORY GAME FOR TWO' : phase === 'result' ? (game.active ? 'PERFECT PATTERN!' : 'THANKS FOR PLAYING!') : `ROUND ${(game.score || 0) + 1}`);
    const highlight = game.highlight ?? -1;
    for (let i = 0; i < 3; i++) {
      const x = 17 + i * 45;
      const active = highlight === i;
      this.rect(x + 2, 63, 34, 35, 1);
      this.rect(x, 59, 34, 35, active ? 3 : 0);
      this.box(x, 59, 34, 35, 3, active ? 2 : 1);
      this.text('ABC'[i], x + 17, 69, active ? 0 : 3, 3, 'center');
      if (active) this.rect(x + 12, 88, 10, 2, 0);
    }
    if (phase === 'show' || phase === 'input') {
      const length = game.sequence?.length || 1;
      const start = Math.max(16, 80 - Math.min(length, 16) * 4);
      for (let i = 0; i < Math.min(length, 16); i++) {
        const reached = phase === 'show' ? i <= (game.showIndex ?? -1) : i < (game.inputIndex || 0);
        this.rect(start + i * 8, 103, 5, 3, reached ? 3 : 1);
      }
      this.text(phase === 'show' ? 'WATCH THE PATTERN...' : 'YOUR TURN!', 80, 115, 3, 1, 'center');
      this.footer(phase === 'show' ? 'LISTEN CLOSELY' : 'REPEAT WITH A / B / C');
    } else if (phase === 'result') {
      this.text(`SCORE ${game.score || 0}  BEST ${s.highScores?.memory || 0}`, 80, 105, 3, 1, 'center');
      this.text(game.result || 'EVERY TRY GROWS YOUR BOND.', 80, 116, 2, 1, 'center');
      this.footer(game.active ? 'GET READY FOR THE NEXT ROUND' : 'B AGAIN   C BACK');
    } else {
      this.text('WATCH. REMEMBER. REPEAT.', 80, 107, 3, 1, 'center');
      this.text('HOW FAR CAN YOU GO?', 80, 117, 2, 1, 'center');
      this.footer('B START   C BACK');
    }
  }
}

export const LCD_PALETTE = INK;
