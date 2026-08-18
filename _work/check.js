/*
  Verificação estática do site inteiro. Não substitui olhar no navegador,
  mas pega a classe de erro que mais apareceu por aqui: escape comido,
  seletor colapsado, link apontando para arquivo que não existe.

  Run: node _work/check.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let bad = 0;
const check = (label, ok, detail) => {
  console.log((ok ? '  ok  ' : ' FALHA ') + label + (detail ? '  → ' + detail : ''));
  if (!ok) bad++;
};

const pages = ['index.html']
  .concat(fs.readdirSync(path.join(root, 'adega')).map((f) => 'adega/' + f))
  .concat(fs.readdirSync(path.join(root, 'politicas')).map((f) => 'politicas/' + f));

const js = fs.readFileSync(path.join(root, 'assets', 'site.js'), 'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'catalog.json'), 'utf8'));

/* ── O script compartilhado ───────────────────────────────────────────── */
try {
  new vm.Script(js);
  check('site.js parseia', true);
} catch (e) {
  check('site.js parseia', false, e.message);
}

/* Escapes somem quando este arquivo passa por heredoc de shell: /[^\d,]/
   vira /[^d,]/, que ainda parseia e simplesmente para de casar. */
const maimed = [...new Set([...js.matchAll(/\[\^?[dswDSW],?\]/g)].map((m) => m[0]))];
check('sem classes de regex mutiladas', maimed.length === 0, maimed.join(' '));

/* $ é querySelector e $$ é querySelectorAll; um $$ colapsado ainda parseia
   mas estoura no .forEach, matando tudo que vem depois. */
const collapsed = [...js.matchAll(/(^|[^$])\$\([^)]*\)\.forEach/gm)].map((m) => m[0].trim());
check('nenhum $$ colapsado em $', collapsed.length === 0, collapsed.join(' | '));

/* ── Contagem de páginas ──────────────────────────────────────────────── */
check('páginas geradas', pages.length === 26, pages.length + ' (1 home + 20 adega + 5 info)');

/* ── Cada página ──────────────────────────────────────────────────────── */
const MARK = '/' + '*CATALOG*' + '/';
let totalItems = 0;
const problems = [];

pages.forEach((rel) => {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  const dir = path.dirname(path.join(root, rel));

  /* Todo href/src local tem de existir no disco. */
  [...html.matchAll(/(?:href|src)="((?!https?:|\/\/|#|data:|mailto:|tel:)[^"]+)"/g)]
    .forEach((m) => {
      const target = m[1].split('#')[0];
      if (!target) return;
      if (!fs.existsSync(path.resolve(dir, target))) problems.push(rel + ' → ' + m[1]);
    });

  /* O bloco de dados tem de parsear do mesmo jeito que a página parseia. */
  const slot = html.match(/<script type="application\/json" id="catData">([\s\S]*?)<\/script>/);
  if (!slot) {
    if (rel.startsWith('politicas/')) return;   // páginas de texto não têm dados
    problems.push(rel + ' → sem bloco catData');
    return;
  }
  try {
    const data = JSON.parse(slot[1].split(MARK).join(''));
    if (data.items) totalItems += data.items.length;

    /* As fotos entram no src pelo JS, então nenhum href/src do HTML aponta
       para elas — este é o único lugar que confere se o caminho existe. */
    (data.items || []).concat(data.topics || []).forEach((it) => {
      if (!it.i || /^https?:/.test(it.i)) return;
      if (!fs.existsSync(path.resolve(dir, it.i))) problems.push(rel + ' → foto ' + it.i);
    });
    if (rel === 'index.html' && (!data.topics || data.topics.length !== 19)) {
      problems.push('index.html → índice com ' + (data.topics || []).length + ' categorias');
    }
  } catch (e) {
    problems.push(rel + ' → catData inválido: ' + e.message);
  }
});

check('links locais resolvem', problems.length === 0, problems.slice(0, 6).join(' | '));

/* O script compartilhado mexe no nav, no rodapé e no carrinho sem checar se
   existem — são o esqueleto de toda página. Se o build recortar errado, o
   script morre na primeira página interna. Confere id a id. */
const shell = (() => {
  const i = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const cut = (a, b) => i.slice(i.indexOf(a) + a.length, i.indexOf(b, i.indexOf(a)));
  const chunk = cut('<body>', '<main id="main">') + cut('</main>', '<script type="application/json"');
  return [...new Set([...chunk.matchAll(/id="([A-Za-z][\w-]*)"/g)].map((m) => m[1]))];
})();

const naked = [];
pages.filter((p) => p !== 'index.html').forEach((rel) => {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  shell.forEach((id) => {
    if (!html.includes('id="' + id + '"')) naked.push(rel + ' sem #' + id);
  });
});
check('esqueleto completo em toda página (' + shell.length + ' ids)',
  naked.length === 0, naked.slice(0, 5).join(' | '));

/* todos.html repete o catálogo inteiro, então some duas vezes. */
check('itens somados nas páginas de categoria', totalItems === catalog.items.length * 2,
  totalItems + ' (esperado ' + catalog.items.length * 2 + ')');

/* ── Home ─────────────────────────────────────────────────────────────── */
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
check('fileira de garrafas removida', !home.includes('id="rail"'));
check('seção catálogo antiga removida', !home.includes('id="catalogo"'));
check('coluna Informações no rodapé', home.includes('<h4>Informações</h4>'));

/* As linhas do cardápio não têm atributo de preço — o script lê o preço
   impresso. Roda a mesma leitura aqui para não subir um preço ilegível. */
const rows = [...home.matchAll(/mrow__name">([\s\S]*?)<\/h3>[\s\S]*?mrow__price num">([\s\S]*?)<\/p>/g)];
check('linhas do cardápio', rows.length === 14, rows.length + '');
const prices = rows.map(([, , p]) =>
  Math.round(parseFloat(p.replace(/<[^>]+>/g, '').replace(/[^0-9,]/g, '').replace(',', '.')) * 100));
check('todo prato com preço legível', prices.every((c) => Number.isInteger(c) && c > 0));

check('[hidden] com !important',
  fs.readFileSync(path.join(root, 'assets', 'site.css'), 'utf8')
    .includes('[hidden]{display:none!important}'));

process.exit(bad ? 1 : 0);
