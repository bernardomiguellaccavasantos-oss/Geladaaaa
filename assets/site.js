/* ═══════════════════════════════════════════════════════════════════════
   All behaviour is written against plain DOM APIs so the page is fully
   usable with zero third-party JS. Lenis is the single optional dependency
   and only smooths the scroll — if it fails to load, native scrolling and
   every animation below still work.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine    = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ── Scroll source ────────────────────────────────────────────────
     One place that reports scroll position, whether Lenis is driving
     it or the browser is. Everything else subscribes here. */
  var scrollY = window.scrollY || 0;
  var subs = [];
  var onScroll = function (fn) { subs.push(fn); };
  var emit = function () { for (var i = 0; i < subs.length; i++) subs[i](scrollY); };

  window.addEventListener('load', function () {
    if (reduced || typeof window.Lenis !== 'function') return;
    var lenis = new window.Lenis({ duration: 1.05, smoothWheel: true, touchMultiplier: 1.6 });
    window.__lenis = lenis;   // exposed so scripted scrolling stays in sync
    lenis.on('scroll', function (e) { scrollY = e.scroll; emit(); });
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);

    // Keep in-page anchors working through Lenis.
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        var id = a.getAttribute('href');
        if (id.length < 2) return;
        var el = document.querySelector(id);
        if (!el) return;
        ev.preventDefault();
        lenis.scrollTo(el, { offset: -70 });
      });
    });
  });

  var ticking = false;
  window.addEventListener('scroll', function () {
    scrollY = window.scrollY;
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { emit(); ticking = false; });
  }, { passive: true });

  /* ── Loader + hero entrance ──────────────────────────────────────── */
  var start = function () {
    document.body.classList.add('loaded');
    requestAnimationFrame(function () { document.body.classList.add('ready'); });
  };
  if (reduced) {
    start();
  } else {
    window.addEventListener('load', function () { setTimeout(start, 850); });
    // Never let a slow asset hold the page hostage.
    setTimeout(start, 3600);
  }

  /* ── Reveal on enter ─────────────────────────────────────────────── */
  var io = 'IntersectionObserver' in window
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.add('-in');
          io.unobserve(en.target);
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 })
    : null;

  if (io) $$('[data-reveal]').forEach(function (el) { io.observe(el); });
  else $$('[data-reveal]').forEach(function (el) { el.classList.add('-in'); });

  /* ── Count-up ────────────────────────────────────────────────────── */
  var counters = $$('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !reduced) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        cio.unobserve(el);
        var target = parseInt(el.dataset.count, 10);
        var t0 = 0, dur = 1100;
        requestAnimationFrame(function step(ts) {
          if (!t0) t0 = ts;
          var p = Math.min((ts - t0) / dur, 1);
          el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(step);
        });
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(function (el) { el.textContent = el.dataset.count; });
  }

  /* ── Parallax ────────────────────────────────────────────────────── */
  var pxItems = $$('[data-parallax]').map(function (el) {
    return { el: el, k: parseFloat(el.dataset.parallax) || 0, y: 0, top: 0, h: 0 };
  });
  var measure = function () {
    var y = window.scrollY;
    pxItems.forEach(function (it) {
      var r = it.el.getBoundingClientRect();
      it.top = r.top + y; it.h = r.height;
    });
  };
  /* Below 760px the collages drop their staggered offsets and sit on a plain
     grid, so drifting the tiles independently only breaks the alignment the
     layout just asked for. Same breakpoint as the stylesheet. */
  var flat = window.matchMedia('(max-width:760px)');
  if (pxItems.length && !reduced) {
    measure();
    window.addEventListener('resize', measure);
    flat.addEventListener('change', function () {
      if (flat.matches) { pxItems.forEach(function (it) { it.el.style.transform = ''; }); return; }
      measure(); emit();   // re-place the tiles without waiting for a scroll
    });
    onScroll(function (y) {
      if (flat.matches) return;
      var vh = window.innerHeight;
      pxItems.forEach(function (it) {
        if (it.top + it.h < y - 200 || it.top > y + vh + 200) return;
        var rel = (y + vh / 2) - (it.top + it.h / 2);
        it.el.style.transform = 'translate3d(0,' + (rel * it.k).toFixed(2) + 'px,0)';
      });
    });
  }

  /* ── Progress bar ────────────────────────────────────────────────── */
  var bar = $('#progress');
  onScroll(function (y) {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')';
  });

  /* ── Nav: solid on scroll, hide on scroll-down ───────────────────── */
  var nav = $('#nav'), lastY = 0;
  onScroll(function (y) {
    nav.classList.toggle('-solid', y > 40);
    nav.classList.toggle('-hide', y > 420 && y > lastY && !drawer.classList.contains('-on'));
    lastY = y;
  });

  /* ── Nav: active section ─────────────────────────────────────────── */
  var navLinks = $$('.nav__links a');
  if ('IntersectionObserver' in window) {
    var secIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + en.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['portas', 'cardapio', 'adega', 'noite', 'entrega'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) secIo.observe(el);
    });
  }

  /* ── Mobile drawer ───────────────────────────────────────────────── */
  var burger = $('#burger'), drawer = $('#drawer');
  var setDrawer = function (open) {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    drawer.classList.toggle('-on', open);
    document.body.classList.toggle('is-locked', open);
  };
  burger.addEventListener('click', function () {
    setDrawer(burger.getAttribute('aria-expanded') !== 'true');
  });
  $$('a', drawer).forEach(function (a) { a.addEventListener('click', function () { setDrawer(false); }); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('-on')) { setDrawer(false); burger.focus(); }
  });

  /* ── Menu: filters ───────────────────────────────────────────────── */
  var chips = $$('.menu__filters .chip'), rows = $$('.mrow');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.setAttribute('aria-selected', String(c === chip)); });
      var f = chip.dataset.filter;
      rows.forEach(function (r) { r.classList.add('-fade'); });
      setTimeout(function () {
        var n = 0;
        rows.forEach(function (r) {
          var show = f === 'all' || r.dataset.cat === f;
          r.classList.toggle('-hidden', !show);
          if (show) { n++; var idx = $('.mrow__idx', r); if (idx) idx.textContent = ('0' + n).slice(-2); }
        });
        requestAnimationFrame(function () { rows.forEach(function (r) { r.classList.remove('-fade'); }); });
      }, 180);
    });
  });

  /* ── Menu: cursor-follow photo ───────────────────────────────────
     Desktop only. On touch the row shows its own thumbnail instead
     (see .mrow__thumb in the stylesheet), so nothing is lost. */
  if (fine && !reduced && $('#peek')) {
    var peek = $('#peek'), peekImg = $('#peekImg');
    var px = 0, py = 0, tx = 0, ty = 0, peeking = false;
    var pw = 0, ph = 0;
    var sizePeek = function () { pw = peek.offsetWidth; ph = peek.offsetHeight; };
    sizePeek();
    window.addEventListener('resize', sizePeek);

    window.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });

    rows.forEach(function (row) {
      row.addEventListener('mouseenter', function () {
        var src = row.dataset.img;
        if (peekImg.getAttribute('src') !== src) {
          peekImg.classList.remove('-on');
          peekImg.onload = function () { peekImg.classList.add('-on'); };
          peekImg.src = src;
        } else {
          peekImg.classList.add('-on');
        }
        // Snap to the pointer on first show so it doesn't fly in from 0,0.
        if (!peeking) { py = ty; }
        peek.classList.add('-on');
        peeking = true;
      });
      row.addEventListener('mouseleave', function () {
        peek.classList.remove('-on');
        peeking = false;
      });
    });

    var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
    (function loop() {
      if (peeking) {
        px += (tx - px) * 0.12;
        py += (ty - py) * 0.12;
        // X is anchored to the empty column between the dish name and its
        // price; only Y follows the pointer. Chasing X as well means the photo
        // lands on top of the very name you just hovered.
        var ox = clamp(window.innerWidth * 0.64, pw / 2 + 20, window.innerWidth - pw / 2 - 20);
        var oy = clamp(py, ph / 2 + 12, window.innerHeight - ph / 2 - 12);
        peek.style.transform = 'translate3d(' + (ox - pw / 2) + 'px,' + (oy - ph / 2) + 'px,0)';
      }
      requestAnimationFrame(loop);
    })();
  }

  /* ── Custom cursor ───────────────────────────────────────────────── */
  if (fine && !reduced) {
    var cur = $('#cursor'), curLabel = $('#curLabel');
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2, mx = cx, my = cy;
    document.body.classList.add('cursor-on');
    window.addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });
    (function loop() {
      cx += (mx - cx) * 0.18;
      cy += (my - cy) * 0.18;
      cur.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      requestAnimationFrame(loop);
    })();

    var setCur = function (state, label) {
      document.body.classList.remove('cur-view', 'cur-drag', 'cur-link');
      if (state) document.body.classList.add('cur-' + state);
      if (label) curLabel.textContent = label;
    };
    $$('[data-cursor="view"]').forEach(function (el) {
      el.addEventListener('mouseenter', function () { setCur('view', 'ver'); });
      el.addEventListener('mouseleave', function () { setCur(null); });
    });
    $$('[data-cursor="drag"]').forEach(function (el) {
      el.addEventListener('mouseenter', function () { setCur('drag', 'arraste'); });
      el.addEventListener('mouseleave', function () { setCur(null); });
    });
    $$('a, button').forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        if (!document.body.classList.contains('cur-view') &&
            !document.body.classList.contains('cur-drag')) setCur('link');
      });
      el.addEventListener('mouseleave', function () {
        if (document.body.classList.contains('cur-link')) setCur(null);
      });
    });
  }

  /* ── Adega rail: drag + progress ─────────────────────────────────── */
  var rail = $('#rail'), railBar = $('#railBar'), railHint = $('#railHint');
  if (rail) {
    var down = false, startX = 0, startLeft = 0, moved = 0;

    var updateBar = function () {
      var max = rail.scrollWidth - rail.clientWidth;
      var p = max > 0 ? rail.scrollLeft / max : 0;
      var track = rail.parentElement.querySelector('.rail__bar');
      var w = track ? track.clientWidth : 0;
      railBar.style.transform = 'translateX(' + (p * (w - w * 0.22)) + 'px)';
      if (p > 0.02 && railHint.textContent !== 'Role para ver mais') railHint.textContent = 'Role para ver mais';
    };
    rail.addEventListener('scroll', updateBar, { passive: true });
    window.addEventListener('resize', updateBar);
    updateBar();

    rail.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;   // native touch scrolling is better
      down = true; moved = 0;
      startX = e.clientX; startLeft = rail.scrollLeft;
      rail.classList.add('-grabbing');
      rail.setPointerCapture(e.pointerId);
    });
    rail.addEventListener('pointermove', function (e) {
      if (!down) return;
      var d = e.clientX - startX;
      moved = Math.abs(d);
      rail.scrollLeft = startLeft - d;
    });
    var release = function (e) {
      if (!down) return;
      down = false;
      rail.classList.remove('-grabbing');
      try { rail.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    rail.addEventListener('pointerup', release);
    rail.addEventListener('pointercancel', release);

    // Vertical wheel over the rail should move it sideways, but only while
    // there is still rail left to travel — otherwise the page must scroll.
    rail.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      var max = rail.scrollWidth - rail.clientWidth;
      var next = rail.scrollLeft + e.deltaY;
      if (next > 0 && next < max) { e.preventDefault(); rail.scrollLeft = next; }
    }, { passive: false });

    rail.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { rail.scrollLeft += 260; e.preventDefault(); }
      if (e.key === 'ArrowLeft')  { rail.scrollLeft -= 260; e.preventDefault(); }
    });
  }

  /* ── FAQ accordion ───────────────────────────────────────────────── */
  $$('.acc__btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.acc__item');
      var open = btn.getAttribute('aria-expanded') === 'true';
      $$('.acc__item').forEach(function (it) {
        it.classList.remove('-open');
        $('.acc__btn', it).setAttribute('aria-expanded', 'false');
      });
      if (!open) { item.classList.add('-open'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });

  /* ── Open / closed, in São Paulo time ────────────────────────────
     The room is open 11:00–23:00 every day. Read the clock in the
     venue's timezone so a visitor abroad still sees the truth. */
  var OPEN = 11, CLOSE = 23;
  var spNow = function () {
    try {
      var p = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(new Date());
      var h = 0, m = 0;
      p.forEach(function (x) {
        if (x.type === 'hour') h = parseInt(x.value, 10);
        if (x.type === 'minute') m = parseInt(x.value, 10);
      });
      return h + m / 60;
    } catch (_) {
      var d = new Date();
      return d.getHours() + d.getMinutes() / 60;
    }
  };
  var paintStatus = function () {
    var t = spNow();
    var open = t >= OPEN && t < CLOSE;
    var label, line;
    if (open) {
      var left = CLOSE - t;
      label = left <= 1 ? 'Fechando em breve' : 'Aberto agora';
      line = 'Aberto agora — fecha às 23h.';
    } else {
      label = 'Fechado';
      line = t < OPEN ? 'Fechado — abre hoje às 11h.' : 'Fechado — abre amanhã às 11h.';
    }
    ['#status', '#statusM'].forEach(function (sel) {
      var el = $(sel);
      if (!el) return;
      el.classList.toggle('-open', open);
      $('span', el).textContent = label;
    });
    var sl = $('#statusLine');
    if (sl) sl.textContent = line;
  };
  paintStatus();
  setInterval(paintStatus, 60000);

  /* ── WhatsApp float ──────────────────────────────────────────────── */
  var wa = $('#wa');
  onScroll(function (y) { wa.classList.toggle('-on', y > 700); });

  /* ── Catálogo & carrinho ─────────────────────────────────────────────
     The 313 SKUs live in assets/catalog.json, rebuilt from the Shopify
     storefront by _work/catalog.js. Money is handled in centavos end to
     end — floats would drift a few centavos across a big order and the
     number the customer reads has to match the number they get charged.
     ─────────────────────────────────────────────────────────────────── */
  var WA_NUM    = '5511916070206';
  var FREE_FROM = 50000;            // frete grátis a partir de R$ 500,00
  var STORE_KEY = 'gelada.cart.v1';
  var PAGE      = 24;

  var brl = function (cents) {
    return 'R$ ' + (cents / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };
  /* "Cachaça" has to match a typed "cachaca", so fold accents on both sides. */
  var fold = function (s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  var catGrid  = $('#catGrid'), catQ = $('#catQ'), catTopics = $('#catTopics');
  var catTally = $('#catTally'), catMore = $('#catMore'), catEmpty = $('#catEmpty');

  /* ── Cart state ─────────────────────────────────────────────────────
     Each line keeps its own name and price rather than pointing back at
     the catalog, so a cart restored from localStorage still renders (and
     still totals) even if the catalog fetch is slow or fails. */
  var cart = [];
  try {
    var saved = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    if (Array.isArray(saved)) {
      cart = saved.filter(function (l) {
        return l && typeof l.id === 'string' && typeof l.p === 'number' && l.q > 0;
      });
    }
  } catch (e) { cart = []; }

  var persist = function () {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(cart)); } catch (e) {}
  };
  var units = function () {
    return cart.reduce(function (n, l) { return n + l.q; }, 0);
  };
  var total = function () {
    return cart.reduce(function (n, l) { return n + l.p * l.q; }, 0);
  };

  /* ── Adega: índice e prateleira ──────────────────────────────────────
     Duas páginas, um script. A home traz só o índice (#catTopics) e cada
     categoria tem a sua própria página com a grade (#catGrid). O que cada
     uma precisa vem no bloco #catData embutido nela — nada de fetch, para
     a página abrir também direto do disco. */
  var catalog = { topics: [], items: [] };
  try {
    var mark = '/' + '*CATALOG*' + '/';
    var raw = $('#catData');
    if (raw) catalog = JSON.parse(raw.textContent.split(mark).join(''));
  } catch (e) { /* tratado abaixo, por página */ }

  /* ── Índice de categorias (home) ─────────────────────────────────── */
  if (catTopics) {
    if (!catalog.topics.length) {
      catTopics.hidden = true;
      if (catTally) catTally.textContent = 'Catálogo indisponível';
    } else {
      var frag = document.createDocumentFragment();
      catalog.topics.forEach(function (t) {
        var a = document.createElement('a');
        a.className = 'topic';
        a.href = t.href;
        a.innerHTML =
          '<span class="topic__media">' +
            '<img src="' + t.i + '" width="400" height="300" loading="lazy" decoding="async" alt="">' +
          '</span>' +
          '<span class="topic__body"><span class="topic__name"></span><span class="topic__n"></span></span>';
        $('.topic__name', a).textContent = t.c;
        $('.topic__n', a).textContent = t.n + (t.n === 1 ? ' rótulo' : ' rótulos');
        frag.appendChild(a);
      });
      catTopics.appendChild(frag);
      if (catTally) {
        catTally.textContent = catalog.total + ' rótulos em ' + catalog.topics.length + ' categorias';
      }
    }
  }

  /* ── Prateleira aberta (página de categoria) ─────────────────────── */
  var card = function (it) {
    var el = document.createElement('article');
    el.className = 'prod';
    el.innerHTML =
      '<div class="prod__media">' +
        (it.b ? '<span class="prod__flag">Mais vendido</span>' : '') +
        '<img src="' + it.i + '" width="400" height="400" loading="lazy" decoding="async" alt="">' +
      '</div>' +
      '<div class="prod__body">' +
        '<p class="prod__cat"></p><h3 class="prod__name"></h3>' +
      '</div>' +
      '<div class="prod__foot">' +
        '<p class="prod__price num"></p>' +
        '<button class="prod__add" type="button">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">' +
            '<path d="M12 5v14M5 12h14"></path></svg>' +
        '</button>' +
      '</div>';
    /* Os nomes vêm da loja, então entram como texto, nunca como HTML. */
    $('.prod__cat', el).textContent   = it.c;
    $('.prod__name', el).textContent  = it.n;
    $('.prod__price', el).textContent = brl(it.p);

    var add = $('.prod__add', el);
    add.setAttribute('aria-label', 'Adicionar ' + it.n + ' ao carrinho');
    add.addEventListener('click', function () {
      addLine(it);
      add.classList.add('-done');
      setTimeout(function () { add.classList.remove('-done'); }, 420);
    });
    return el;
  };

  if (catGrid) {
    var items = catalog.items, view = items, shown = 0;

    /* Acrescenta a próxima fatia em vez de redesenhar — mantém na tela as
       imagens que o navegador já decodificou. */
    var pour = function () {
      var frag2 = document.createDocumentFragment();
      var stop = Math.min(shown + PAGE, view.length);
      for (var i = shown; i < stop; i++) frag2.appendChild(card(view[i]));
      catGrid.appendChild(frag2);
      shown = stop;
      catMore.hidden = shown >= view.length;
    };

    var refilter = function () {
      var q = fold(catQ ? catQ.value.trim() : '');
      view = !q ? items : items.filter(function (it) {
        return fold(it.n).indexOf(q) > -1 || fold(it.c).indexOf(q) > -1;
      });
      catGrid.textContent = '';
      shown = 0;
      catEmpty.hidden = view.length > 0;
      catTally.textContent = view.length === items.length
        ? items.length + (items.length === 1 ? ' rótulo' : ' rótulos')
        : view.length + ' de ' + items.length + ' rótulos';
      pour();
    };

    if (!items.length) {
      catTally.textContent = 'Catálogo indisponível';
      catMore.hidden = true;
      catEmpty.hidden = false;
      catEmpty.textContent = 'Não deu para carregar a adega agora. Chama no WhatsApp que a gente manda a lista.';
    } else {
      refilter();
      if (catQ) catQ.addEventListener('input', refilter);
      catMore.addEventListener('click', pour);
    }
  }



  /* ── Cart ────────────────────────────────────────────────────────── */
  var cartEl   = $('#cart'), cartBody = $('#cartBody'), cartVoid = $('#cartVoid');
  var cartFab  = $('#cartFab'), cartCount = $('#cartCount');
  var cartSum  = $('#cartTotal'), cartShip = $('#cartShip'), cartGo = $('#cartGo');

  var message = function () {
    var lines = ['Olá! Quero fazer um pedido pelo site:', ''];
    cart.forEach(function (l) {
      lines.push('• ' + l.q + 'x ' + l.n + ' — ' + brl(l.p * l.q));
    });
    lines.push('', 'Subtotal: ' + brl(total()));
    lines.push(total() >= FREE_FROM
      ? 'Frete: grátis (pedido acima de R$ 500,00)'
      : 'Frete: a confirmar');
    return lines.join('\n');
  };

  var line = function (l) {
    var el = document.createElement('div');
    el.className = 'citem';
    el.innerHTML =
      '<div class="citem__media">' +
        (l.i ? '<img src="' + l.i + '" width="58" height="58" loading="lazy" decoding="async" alt="">' : '') +
      '</div>' +
      '<div>' +
        '<p class="citem__name"></p>' +
        '<p class="citem__unit"></p>' +
        '<div class="citem__row">' +
          '<div class="citem__qty">' +
            '<button type="button" data-step="-1" aria-label="Tirar um">−</button>' +
            '<b></b>' +
            '<button type="button" data-step="1" aria-label="Colocar mais um">+</button>' +
          '</div>' +
          '<p class="citem__sum num"></p>' +
        '</div>' +
      '</div>';
    $('.citem__name', el).textContent = l.n;
    $('.citem__unit', el).textContent = brl(l.p) + ' cada';
    $('.citem__qty b', el).textContent = l.q;
    $('.citem__sum', el).textContent = brl(l.p * l.q);
    $$('button', el).forEach(function (b) {
      b.addEventListener('click', function () { step(l.id, +b.dataset.step); });
    });
    return el;
  };

  var paintCart = function () {
    var n = units();
    cartCount.textContent = n;
    cartFab.classList.toggle('-on', n > 0);
    cartFab.setAttribute('aria-label', n + (n === 1 ? ' item no carrinho' : ' itens no carrinho'));

    $$('.citem', cartBody).forEach(function (el) { el.remove(); });
    cart.forEach(function (l) { cartBody.appendChild(line(l)); });
    cartVoid.hidden = cart.length > 0;

    var t = total();
    cartSum.textContent = brl(t);
    cartShip.innerHTML = '';
    if (t >= FREE_FROM) {
      cartShip.textContent = 'Frete grátis — o pedido passou de R$ 500,00.';
    } else if (t > 0) {
      cartShip.textContent = 'Faltam ' + brl(FREE_FROM - t) + ' para o frete sair de graça.';
    } else {
      cartShip.textContent = 'Frete grátis acima de R$ 500,00.';
    }

    $('#cartWipe').hidden = n === 0;
    cartGo.href = 'https://wa.me/' + WA_NUM + '?text=' + encodeURIComponent(message());
    cartGo.setAttribute('aria-disabled', String(n === 0));
    cartGo.style.opacity = n === 0 ? '.45' : '';
    cartGo.style.pointerEvents = n === 0 ? 'none' : '';
  };

  function addLine(it) {
    var found = null;
    for (var i = 0; i < cart.length; i++) if (cart[i].id === it.id) found = cart[i];
    if (found) found.q++;
    else cart.push({ id: it.id, n: it.n, p: it.p, i: it.i, q: 1 });
    persist();
    paintCart();
  }

  function step(id, by) {
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id !== id) continue;
      cart[i].q += by;
      if (cart[i].q < 1) cart.splice(i, 1);
      break;
    }
    persist();
    paintCart();
  }

  var setCart = function (open) {
    cartEl.classList.toggle('-on', open);
    cartFab.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('is-locked', open);
    /* Lenis keeps driving the page behind a plain overflow:hidden, so it
       has to be told to stand down while the panel is up. */
    if (window.__lenis) window.__lenis[open ? 'stop' : 'start']();
    if (open) $('#cartClose').focus();
  };

  cartFab.addEventListener('click', function () { setCart(true); });
  $('#cartClose').addEventListener('click', function () { setCart(false); cartFab.focus(); });
  $('#cartVeil').addEventListener('click', function () { setCart(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && cartEl.classList.contains('-on')) { setCart(false); cartFab.focus(); }
  });
  /* The order is not placed until the customer actually sends the message,
     so the cart survives the hand-off. Emptying it is their call. */
  $('#cartWipe').addEventListener('click', function () {
    cart = [];
    persist();
    paintCart();
  });

  /* ── Cozinha: mesmas linhas, mesmo carrinho ──────────────────────────
     Nome e preço saem da própria linha em vez de um atributo paralelo —
     assim o que o cliente lê é literalmente o que entra na conta. */
  $$('.mrow').forEach(function (row) {
    var btn = $('.mrow__add', row);
    if (!btn) return;

    var head = $('.mrow__name', row).cloneNode(true);
    var tag = $('.mrow__tag', head);
    if (tag) tag.remove();
    var name = head.textContent.trim();

    var cents = Math.round(parseFloat(
      $('.mrow__price', row).textContent.replace(/[^0-9,]/g, '').replace(',', '.')
    ) * 100);
    if (!cents) return;

    /* Prefixed so a dish can never share a line with an adega handle. */
    var it = {
      id: 'cozinha-' + fold(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      n: name, p: cents, i: row.dataset.img,
    };
    btn.setAttribute('aria-label', 'Adicionar ' + name + ' ao carrinho');
    btn.addEventListener('click', function () {
      addLine(it);
      btn.classList.add('-done');
      setTimeout(function () { btn.classList.remove('-done'); }, 420);
    });
  });

  paintCart();

  $('#yr').textContent = new Date().getFullYear();
})();
