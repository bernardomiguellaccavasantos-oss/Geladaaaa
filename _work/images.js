/*
  Baixa as fotos dos produtos para assets/produtos/ e reescreve o caminho no
  assets/catalog.json, para o site parar de depender do CDN da Shopify.

  Pede WebP no cabeçalho Accept: a Shopify serve JPEG por padrão e WebP quando
  o cliente diz que aceita — o mesmo arquivo cai de ~12 kB para ~8 kB. Não há
  recompressão local: o CDN já entrega otimizado e passar de novo por um
  compressor só perderia qualidade.

  Idempotente — o que já está no disco não é baixado outra vez.

  Ordem:  node _work/catalog.js  →  node _work/images.js  →  node _work/build.js
*/
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'assets', 'produtos');
const catFile = path.join(root, 'assets', 'catalog.json');

const WIDTH = 400;          // cards têm 186–212 px de largura; 400 cobre 2x
const LOTE = 8;             // simultâneas, para não irritar o CDN
const ACCEPT = 'image/webp,image/*';

fs.mkdirSync(dir, { recursive: true });
const catalog = JSON.parse(fs.readFileSync(catFile, 'utf8'));

/* Já baixado antes? O caminho local não tem protocolo. */
const isRemote = (u) => /^https?:/.test(u);

const grab = async (it) => {
  const file = it.id + '.webp';
  const dest = path.join(dir, file);
  const local = 'assets/produtos/' + file;

  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return { it, local, cached: true };
  if (!isRemote(it.i)) return { it, local: it.i, cached: true };

  const url = it.i.replace(/width=\d+/, 'width=' + WIDTH);
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const r = await fetch(url, { headers: { Accept: ACCEPT } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 500) throw new Error('resposta curta (' + buf.length + ' B)');
      fs.writeFileSync(dest, buf);
      return { it, local, bytes: buf.length };
    } catch (e) {
      if (tentativa === 2) return { it, erro: e.message };
    }
  }
};

(async () => {
  const items = catalog.items;
  let bytes = 0, baixadas = 0, cache = 0;
  const falhas = [];

  for (let i = 0; i < items.length; i += LOTE) {
    const parte = await Promise.all(items.slice(i, i + LOTE).map(grab));
    parte.forEach((r) => {
      if (r.erro) {
        /* Sem foto local, a linha segue apontando para o CDN — melhor uma
           imagem remota do que um card vazio. */
        falhas.push(r.it.id + ': ' + r.erro);
        return;
      }
      r.it.i = r.local;
      if (r.cached) cache++;
      else { baixadas++; bytes += r.bytes; }
    });
    process.stdout.write('\r' + Math.min(i + LOTE, items.length) + '/' + items.length);
  }

  fs.writeFileSync(catFile, JSON.stringify(catalog));

  const total = fs.readdirSync(dir).reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
  console.log('\n\nbaixadas :', baixadas, '(' + (bytes / 1024 / 1024).toFixed(1) + ' MB)');
  console.log('já tinha :', cache);
  console.log('em disco :', fs.readdirSync(dir).length, 'arquivos,', (total / 1024 / 1024).toFixed(1), 'MB');
  if (falhas.length) {
    console.log('\nfalharam (seguem no CDN):', falhas.length);
    falhas.slice(0, 10).forEach((f) => console.log('  ' + f));
  }
  console.log('\nagora rode: node _work/build.js');
})();
