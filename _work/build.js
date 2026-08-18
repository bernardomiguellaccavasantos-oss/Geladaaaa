/*
  Gera as páginas internas a partir do index.html.

  O index é a única fonte do cabeçalho, do rodapé e do carrinho: este script
  recorta esses pedaços dele e os reaproveita, então mexer no menu ou no
  rodapé em um lugar só continua valendo para as 25 páginas.

  Entradas:  index.html, assets/catalog.json, _work/policies.json
  Saídas:    adega/<categoria>.html, adega/todos.html, politicas/<x>.html

  Run: node _work/build.js   (depois de node _work/catalog.js)
*/
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const index = read('index.html');
const catalog = JSON.parse(read('assets/catalog.json'));
const policies = JSON.parse(fs.readFileSync(path.join(__dirname, 'policies.json'), 'utf8'));

const WA = 'https://wa.me/5511916070206';
const MARK = '/' + '*CATALOG*' + '/';

/* ── Pedaços compartilhados ───────────────────────────────────────────── */
const slice = (from, to, label) => {
  const a = index.indexOf(from);
  const b = index.indexOf(to, a + from.length);
  if (a < 0 || b < 0) throw new Error('não achei o bloco ' + label);
  return index.slice(a + from.length, b).trim();
};

/* Loader, grão, barra de progresso, cursor, nav e drawer. */
const TOP = slice('<body>', '<main id="main">', 'topo');
/* Rodapé, botão do carrinho, painel e o flutuante do WhatsApp. */
const FOOT = slice('</main>', '<script type="application/json"', 'rodapé');

/* Tudo aqui é relativo à raiz; as páginas internas moram um nível abaixo. */
const rebase = (html) =>
  html
    .replace(/(href|src)="(?!https?:|\/\/|#|data:|mailto:|tel:|\.\.\/)([^"]+)"/g, '$1="../$2"')
    .replace(/href="#([^"]*)"/g, 'href="../index.html#$1"');

const TOP_SUB = rebase(TOP);
const FOOT_SUB = rebase(FOOT);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/* As fotos ficam em assets/produtos/, caminho escrito a partir da raiz. O JS
   injeta esse valor direto no src, e o rebase() só alcança o HTML fixo — quem
   mora um nível abaixo precisa do ../ aqui. */
const deepen = (items) => items.map((it) =>
  /^https?:/.test(it.i) ? it : Object.assign({}, it, { i: '../' + it.i }));

const page = ({ title, desc, body, data }) => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0a0908">
<title>${esc(title)} — Gelada Pocket Club</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index,follow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,300..900;1,62..125,400..700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/site.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='16' fill='%23f2ece1'/%3E%3Ctext x='16' y='23' font-family='Georgia,serif' font-size='21' font-weight='700' text-anchor='middle' fill='%230a0908'%3EG%3C/text%3E%3C/svg%3E">
</head>

<body class="sub">
${TOP_SUB}

<main id="main">
${body}
</main>

${FOOT_SUB}

<script type="application/json" id="catData">${MARK}${JSON.stringify(data || { topics: [], items: [] })}${MARK}</script>
<script src="https://unpkg.com/lenis@1.1.18/dist/lenis.min.js" defer></script>
<script src="../assets/site.js" defer></script>
</body>
</html>
`;

const BACK = (href, label) => `    <div class="cat__back">
      <a class="cat__up" href="${href}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
          <path d="M15 5l-7 7 7 7"></path>
        </svg>
        ${label}
      </a>
    </div>`;

/* ── Páginas da adega ─────────────────────────────────────────────────── */
const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const shelf = ({ title, lede, items, note }) => `
<section class="section cat -sub">
  <div class="wrap">
${BACK('../index.html#adega', 'Todas as categorias')}

    <div class="shead">
      <div>
        <p class="eyebrow">A adega</p>
        <h1 class="d2">${esc(title)}</h1>
      </div>
      <p class="lede">${esc(lede)}</p>
    </div>

    <div class="cat__tools">
      <label class="cat__search">
        <span class="sr">Buscar rótulo</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path>
        </svg>
        <input type="search" id="catQ" placeholder="Buscar por nome" autocomplete="off">
      </label>
      <p class="cat__tally" id="catTally"></p>
    </div>

    <div class="cat__grid" id="catGrid"></div>
    <p class="cat__empty" id="catEmpty" hidden>Nada com esse nome nesta prateleira.</p>

    <div class="cat__more">
      <button class="btn -ghost" id="catMore" hidden>Ver mais rótulos</button>
    </div>

    <div class="menu__foot">
      <p class="menu__note">${esc(note)}</p>
      <a class="btn" href="todos.html">Ver os ${catalog.items.length} rótulos</a>
    </div>
  </div>
</section>`;

fs.mkdirSync(path.join(root, 'adega'), { recursive: true });
fs.mkdirSync(path.join(root, 'politicas'), { recursive: true });

const topics = [];
catalog.cats.forEach((c) => {
  const items = catalog.items.filter((it) => it.c === c);
  if (!items.length) return;
  const file = slug(c) + '.html';
  topics.push({ c, n: items.length, i: items[0].i, href: 'adega/' + file });

  fs.writeFileSync(path.join(root, 'adega', file), page({
    title: c,
    desc: `${items.length} rótulos de ${c.toLowerCase()} na adega do Gelada Pocket Club, com entrega no Tatuapé em 25 a 40 minutos.`,
    body: shelf({
      title: c,
      lede: `${items.length} ${items.length === 1 ? 'rótulo' : 'rótulos'} nesta prateleira. Toca no + para jogar no carrinho — a conta fecha no WhatsApp.`,
      items,
      note: 'Preços conforme o catálogo da loja. Confirmamos estoque antes de sair.',
    }),
    data: { items: deepen(items) },
  }));
});

fs.writeFileSync(path.join(root, 'adega', 'todos.html'), page({
  title: 'Todos os rótulos',
  desc: `Os ${catalog.items.length} rótulos da adega do Gelada Pocket Club, de gelo a absinto.`,
  body: shelf({
    title: 'A adega inteira',
    lede: `Os ${catalog.items.length} rótulos da parede, em ordem de prateleira. Busca pelo nome ou desce rolando.`,
    items: catalog.items,
    note: 'De gelo a absinto, tudo o que sai da geladeira.',
  }),
  data: { items: deepen(catalog.items) },
}));

/* ── Páginas de informações ───────────────────────────────────────────── */
const CONFLITO = `<p class="prose__note"><strong>Nota:</strong> este texto veio do
  catálogo da loja e ainda fala em prazos de entrega por transportadora. Para o
  balcão do Tatuapé valem os prazos da página inicial — de 25 a 40 minutos, das
  11h às 23h. Vale revisar com o jurídico antes de publicar.</p>`;

const infoPage = (slugName, { title, html }, extra) => {
  fs.writeFileSync(path.join(root, 'politicas', slugName + '.html'), page({
    title,
    desc: `${title} do Gelada Pocket Club, Rua Nova Jerusalém, 818, Tatuapé, São Paulo.`,
    body: `
<section class="section -sub">
  <div class="wrap">
${BACK('../index.html', 'Voltar ao site')}
    <div class="prose">
      <p class="eyebrow">Informações</p>
      <h1>${esc(title)}</h1>
      ${html}
      ${extra || ''}
    </div>
  </div>
</section>`,
  }));
};

infoPage('reembolso', policies.reembolso);
infoPage('privacidade', policies.privacidade);
infoPage('termos', policies.termos);
infoPage('frete', policies.frete, CONFLITO);

/* Contato não é política da Shopify — monto com os dados que já estão no site. */
infoPage('contato', {
  title: 'Informações de contato',
  html: `
      <h3>Onde a gente fica</h3>
      <p>Rua Nova Jerusalém, 818 — Tatuapé, São Paulo — SP.</p>

      <h3>Horário</h3>
      <p>Todos os dias, das 11h às 23h.</p>

      <h3>Pedidos e atendimento</h3>
      <p>
        WhatsApp: <a href="${WA}" target="_blank" rel="noopener">(11) 91607-0206</a><br>
        E-mail: <a href="mailto:suporte@geladaclub.com">suporte@geladaclub.com</a><br>
        Instagram: <a href="https://www.instagram.com/geladapocketclub/" target="_blank" rel="noopener">@geladapocketclub</a>
      </p>

      <h3>Entrega</h3>
      <p>De 25 a 40 minutos no Tatuapé e região. Frete grátis acima de R$ 500,00.</p>

      <h3>Dados da empresa</h3>
      <p>Gelada Pocket Club · CNPJ 62.461.316/0001-38</p>

      <h3>Venda para maiores de 18 anos</h3>
      <p>
        A venda de bebida alcoólica para menores de 18 anos é proibida pela
        Lei nº 13.106/2015. Documento com foto pode ser solicitado na entrega
        e no salão.
      </p>`,
});

/* ── Índice na home ───────────────────────────────────────────────────── */
let home = index.replace(
  new RegExp('<script type="application/json" id="catData">[\\s\\S]*?</script>'),
  '<script type="application/json" id="catData">' + MARK +
    JSON.stringify({ topics, total: catalog.items.length }) + MARK + '</script>'
);
fs.writeFileSync(path.join(root, 'index.html'), home);

console.log('categorias :', topics.length, 'páginas');
console.log('informações:', 5, 'páginas');
console.log('home       :', (fs.statSync(path.join(root, 'index.html')).size / 1024).toFixed(0) + ' kB');
