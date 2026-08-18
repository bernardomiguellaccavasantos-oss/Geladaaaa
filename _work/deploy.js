/*
  Lista exatamente o que precisa subir para o servidor, seguindo os links a
  partir das páginas (e do CSS). O que não aparecer aqui é ferramenta de
  build ou material bruto e pode ficar de fora.

  Run: node _work/deploy.js
*/
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rel = (p) => path.relative(root, p).split(path.sep).join('/');

const pages = ['index.html']
  .concat(fs.readdirSync(path.join(root, 'adega')).map((f) => 'adega/' + f))
  .concat(fs.readdirSync(path.join(root, 'politicas')).map((f) => 'politicas/' + f));

const need = new Set(pages);
const EXTERNAL = /^(https?:|\/\/|#|data:|mailto:|tel:)/;

const add = (from, url) => {
  const target = url.split('#')[0].split('?')[0].trim();
  if (!target || EXTERNAL.test(target)) return;
  need.add(rel(path.resolve(path.dirname(path.join(root, from)), target)));
};

const scan = (from, text) => {
  /* href/src simples. */
  for (const m of text.matchAll(/(?:href|src)="([^"]+)"/g)) add(from, m[1]);
  /* srcset e imagesrcset trazem vários caminhos com descritor de largura —
     sem isto as fotos responsivas ficam de fora da lista. */
  for (const m of text.matchAll(/(?:image)?srcset="([^"]+)"/g)) {
    m[1].split(',').forEach((part) => add(from, part.trim().split(/\s+/)[0]));
  }
  /* url() do CSS. O SVG do grão é um data: URI cheio de aspas simples e
     parênteses por dentro, então só aceita o que estiver entre aspas duplas
     ou for um caminho simples — nunca o miolo de um data: URI. */
  for (const m of text.matchAll(/url\((?:"([^"]*)"|'([^']*)'|([^"'()\s]+))\)/g)) {
    add(from, m[1] || m[2] || m[3] || '');
  }
};

/* As fotos dos produtos não aparecem em nenhum href/src: o script as injeta a
   partir do bloco catData. Sem ler esse bloco, 313 arquivos ficariam de fora
   da lista de publicação. */
const MARK = '/' + '*CATALOG*' + '/';
const scanData = (from, text) => {
  const slot = text.match(/<script type="application\/json" id="catData">([\s\S]*?)<\/script>/);
  if (!slot) return;
  let data;
  try { data = JSON.parse(slot[1].split(MARK).join('')); } catch (e) { return; }
  (data.items || []).concat(data.topics || []).forEach((it) => it.i && add(from, it.i));
};

pages.forEach((p) => {
  const html = fs.readFileSync(path.join(root, p), 'utf8');
  scan(p, html);
  scanData(p, html);
});
scan('assets/site.css', fs.readFileSync(path.join(root, 'assets', 'site.css'), 'utf8'));

let bytes = 0;
const missing = [];
const list = [...need].sort();
list.forEach((f) => {
  try { bytes += fs.statSync(path.join(root, f)).size; } catch (e) { missing.push(f); }
});

/* Tudo o que existe na pasta, para separar o que fica de fora. */
const all = [];
(function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    if (e.name === '.git' || e.name === 'node_modules') return;
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p) : all.push(rel(p));
  });
})(root);

const unused = all.filter((f) => !need.has(f));

console.log('PRECISA SUBIR — ' + list.length + ' arquivos, ' + (bytes / 1024 / 1024).toFixed(1) + ' MB');
const byDir = {};
list.forEach((f) => {
  const k = f.includes('/') ? f.split('/')[0] + '/' : '(raiz)';
  byDir[k] = (byDir[k] || 0) + 1;
});
Object.entries(byDir).forEach(([k, v]) => console.log('  ' + String(v).padStart(3) + '  ' + k));

if (missing.length) console.log('\nREFERENCIADO MAS AUSENTE:', missing);

console.log('\nNÃO PRECISA SUBIR — ' + unused.length + ' arquivos');
const byDirU = {};
unused.forEach((f) => {
  const k = f.includes('/') ? f.split('/')[0] + '/' : '(raiz)';
  byDirU[k] = (byDirU[k] || 0) + 1;
});
Object.entries(byDirU).forEach(([k, v]) => console.log('  ' + String(v).padStart(3) + '  ' + k));
