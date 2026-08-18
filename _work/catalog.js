/*
  Builds assets/catalog.json from the live Shopify storefront.

  The store's product_type field is unusable (mostly empty, or the title with an
  internal PM code), so the category comes from collection membership instead.
  Products sit in several collections at once, so PRIMARY is walked in order and
  the first hit wins — specific before generic, which is why cervejas-especiais
  is listed above cervejas.

  Run:  node _work/catalog.js
*/
const fs = require('fs');
const path = require('path');

const SHOP = 'https://geladaclub.com';

/* Order matters: first match becomes the product's shelf. */
const PRIMARY = [
  ['combos',             'Combos'],
  ['nossa-linha',        'Nossa linha'],
  ['cervejas-especiais', 'Cervejas especiais'],
  ['cervejas',           'Cervejas'],
  ['whisky',             'Whisky'],
  ['gins',               'Gins'],
  ['vodkas',             'Vodkas'],
  ['cachacas',           'Cachaças'],
  ['rum',                'Rum'],
  ['tequilas',           'Tequilas'],
  ['licores',            'Licores'],
  ['aperitivos',         'Aperitivos'],
  ['espumantes-1',       'Espumantes'],
  ['vinhos',             'Vinhos'],
  ['bebida-mista',       'Bebida mista'],
  ['energeticos',        'Energéticos'],
  ['refrigerantes',      'Refrigerantes'],
  ['sucos',              'Sucos'],
  ['nao-alcoolicos',     'Não alcoólicos'],
  ['gelo',               'Gelo'],
];

/* Four SKUs belong to no collection upstream and carry no tags or product_type,
   so there is nothing to derive a shelf from. Placed by hand rather than left
   in an "Outros" bucket the customer would have to go hunting through. */
const ORPHANS = {
  'ballena-chocolate-caramelo': 'Licores',
  'licor-don-luiz-dulce-de-leche-cream-750-ml': 'Licores',
  'malibu-750ml': 'Licores',
  'jack-daniels-coke-lata-350ml': 'Bebida mista',
};

const get = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' → ' + r.status);
  return r.json();
};

/* Shopify caps a page at 250, so keep asking until a page comes back short. */
const allPages = async (base) => {
  const out = [];
  for (let page = 1; page < 20; page++) {
    const { products } = await get(base + '?limit=250&page=' + page);
    out.push(...products);
    if (products.length < 250) break;
  }
  return out;
};

/* Thumbnails only — the grid never shows anything near the original size. */
const thumb = (src, w) => src.replace(/(\.[a-z]+)(\?|$)/i, '$1' + '?') .split('?')[0] + '?width=' + w;

(async () => {
  const products = await allPages(SHOP + '/products.json');
  console.log('produtos:', products.length);

  const shelf = new Map();   // handle → [label, order]
  for (let i = 0; i < PRIMARY.length; i++) {
    const [handle, label] = PRIMARY[i];
    const list = await allPages(SHOP + '/collections/' + handle + '/products.json');
    list.forEach((p) => { if (!shelf.has(p.handle)) shelf.set(p.handle, [label, i]); });
    console.log(String(list.length).padStart(3), handle);
  }

  const best = new Set(
    (await allPages(SHOP + '/collections/mais-vendidos/products.json')).map((p) => p.handle)
  );

  const items = products
    .map((p) => {
      const v = p.variants.find((x) => x.available) || p.variants[0];
      const fallback = ORPHANS[p.handle];
      const [cat, order] = shelf.get(p.handle)
        || (fallback ? [fallback, PRIMARY.findIndex((x) => x[1] === fallback)] : ['Outros', 99]);
      return {
        id: p.handle,
        n: p.title.trim(),
        p: Math.round(parseFloat(v.price) * 100),   // centavos, so totals never drift
        c: cat,
        o: order,
        i: p.images.length ? thumb(p.images[0].src, 400) : '',
        b: best.has(p.handle) ? 1 : 0,
      };
    })
    .sort((a, b) => a.o - b.o || b.b - a.b || a.n.localeCompare(b.n, 'pt-BR'))
    .map(({ o, ...rest }) => rest);

  const cats = [];
  items.forEach((it) => { if (!cats.includes(it.c)) cats.push(it.c); });

  const blob = JSON.stringify({ cats, items });
  const out = path.join(__dirname, '..', 'assets', 'catalog.json');
  fs.writeFileSync(out, blob);

  /* O index e as páginas internas recebem o catálogo em _work/build.js,
     que fatia o blob por categoria. Aqui sai só o arquivo bruto. */
  console.log('\ncategorias:', cats.length);
  console.log('sem categoria:', items.filter((i) => i.c === 'Outros').length);
  console.log('sem imagem:', items.filter((i) => !i.i).length);
  console.log('gravado:', out, (fs.statSync(out).size / 1024).toFixed(0) + ' kB');
  console.log('');
  console.log('agora rode: node _work/build.js');
})();
