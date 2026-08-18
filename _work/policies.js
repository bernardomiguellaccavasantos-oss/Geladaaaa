/*
  Puxa o texto das políticas da loja Shopify e grava em _work/policies.json,
  que o build consome. Separado do build porque depende da rede — o build
  precisa rodar offline.

  Run: node _work/policies.js
*/
const fs = require('fs');
const path = require('path');

const SHOP = 'https://geladaclub.com';

const PAGES = [
  ['reembolso',   'refund-policy',    'Política de reembolso'],
  ['privacidade', 'privacy-policy',   'Política de privacidade'],
  ['termos',      'terms-of-service', 'Termos de serviço'],
  ['frete',       'shipping-policy',  'Política de frete'],
];

/* O corpo da política é o único trecho que interessa; o resto é o tema da
   Shopify. Traz só parágrafos e títulos, já limpos de atributos. */
const body = (html) => {
  const m = html.match(/<div class="shopify-policy__body">([\s\S]*?)<\/div>\s*<\/div>/);
  if (!m) throw new Error('corpo não encontrado');
  return m[1]
    .replace(/<meta[^>]*>/gi, '')
    .replace(/\s(class|style|id|dir|data-[\w-]+)="[^"]*"/gi, '')
    .replace(/<(h[1-6])[^>]*>/gi, '<h3>')
    .replace(/<\/h[1-6]>/gi, '</h3>')
    .replace(/<span[^>]*>|<\/span>/gi, '')
    .replace(/<br\s*\/?>/gi, '<br>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

(async () => {
  const out = {};
  for (const [slug, handle, title] of PAGES) {
    const r = await fetch(SHOP + '/policies/' + handle, { redirect: 'follow' });
    if (!r.ok) throw new Error(handle + ' → ' + r.status);
    const html = body(await r.text());
    out[slug] = { title, html };
    console.log(String(html.length).padStart(6), slug);
  }
  fs.writeFileSync(path.join(__dirname, 'policies.json'), JSON.stringify(out, null, 1));
  console.log('\ngravado: _work/policies.json');
})();
