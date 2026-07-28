/* FINCA LAS CUEVAS — interacciones compartidas
   Sin dependencias. Degrada con gracia y respeta prefers-reduced-motion. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- header: fondo sólido al scrollear ----------
     Usamos window.scrollY (no una posición interna de librería): es el
     valor real en todos los casos, incluidos los scrolls programáticos,
     los anclajes y la restauración de posición del navegador. */
  var header = document.querySelector('.header');
  if (header) {
    var stuck = false;
    var applyHeader = function () {
      var should = window.scrollY > 60 || document.body.classList.contains('menu-open');
      if (should !== stuck) {
        stuck = should;
        header.classList.toggle('is-stuck', should);
      }
    };
    window.addEventListener('scroll', applyHeader, { passive: true });
    applyHeader();
  }

  /* ---------- menú móvil ---------- */
  var toggle = document.querySelector('.nav__toggle');
  var mobile = document.querySelector('.nav__mobile');
  if (toggle && mobile) {
    var setMenu = function (open) {
      mobile.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      document.body.classList.toggle('menu-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
      if (header) header.classList.toggle('is-stuck', open || window.scrollY > 60);
    };

    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });

    mobile.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        toggle.focus();
      }
    });

    // al pasar a desktop el menú debe cerrarse y liberar el scroll
    matchMedia('(min-width: 1025px)').addEventListener('change', function (e) {
      if (e.matches) setMenu(false);
    });
  }

  /* ---------- reveal al entrar en viewport ---------- */
  var revealables = document.querySelectorAll('.reveal, .reveal-stagger');
  if (revealables.length) {
    if (reduce || !('IntersectionObserver' in window)) {
      // sin animación: mostramos todo de una
      for (var i = 0; i < revealables.length; i++) revealables[i].classList.add('is-in');
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
      for (var j = 0; j < revealables.length; j++) io.observe(revealables[j]);
    }
  }

  /* ---------- parallax suave ----------
     La imagen tiene sobre-escaneo fijo (118% de alto vía CSS) y sólo la
     desplazamos ±4%, así el movimiento nunca descubre los bordes.
     Se recalcula en un rAF y sólo para los bloques visibles. */
  var parallaxes = [].slice.call(document.querySelectorAll('.parallax'));
  if (parallaxes.length && !reduce) {
    var visibles = [];
    var ticking = false;

    var pio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        var idx = visibles.indexOf(el);
        if (entry.isIntersecting && idx === -1) visibles.push(el);
        else if (!entry.isIntersecting && idx > -1) visibles.splice(idx, 1);
      });
      request();
    }, { rootMargin: '10% 0px' });

    parallaxes.forEach(function (el) { pio.observe(el); });

    function update() {
      ticking = false;
      var vh = window.innerHeight;
      for (var k = 0; k < visibles.length; k++) {
        var el = visibles[k];
        var img = el.firstElementChild;
        if (!img || img.tagName !== 'IMG') continue;
        var r = el.getBoundingClientRect();
        // progreso de 0 (entrando por abajo) a 1 (saliendo por arriba)
        var p = (vh - r.top) / (vh + r.height);
        if (p < 0) p = 0; else if (p > 1) p = 1;
        var y = (p - 0.5) * 8; // ±4%
        img.style.transform = 'translate3d(0,' + y.toFixed(2) + '%,0)';
      }
    }

    function request() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request, { passive: true });
    request();
  }

  /* ---------- video del hero ----------
     Elegimos la versión según el ancho: la vertical pesa una fracción y
     llena la pantalla del celular sin recortar. Con prefers-reduced-motion
     no se carga ningún video: queda el poster.
     El src se asigna acá (no en el HTML) para no descargar los dos. */
  var hero = document.querySelector('.hero__video');
  if (hero) {
    var esMovil = matchMedia('(max-width: 768px)').matches;
    // El HTML trae el poster de móvil (el más liviano) para no penalizar al
    // celular; en pantallas grandes lo cambiamos por el horizontal.
    var posterEscritorio = hero.getAttribute('data-poster-escritorio');
    if (!esMovil && posterEscritorio) hero.setAttribute('poster', posterEscritorio);

    if (!reduce) {
      var fuente = hero.getAttribute(esMovil ? 'data-src-movil' : 'data-src-escritorio');
      if (fuente) {
        // Se carga recién después del primer pintado: el poster ya se ve, y
        // así el video no compite por ancho de banda con el texto y las
        // imágenes de la primera pantalla.
        var arrancar = function () {
          hero.setAttribute('preload', 'auto');
          hero.src = fuente;
          hero.load();
          var play = hero.play();
          if (play && typeof play.catch === 'function') play.catch(function () { /* queda el poster */ });
        };
        var cuandoHayaTiempo = window.requestIdleCallback || function (fn) { setTimeout(fn, 200); };
        if (document.readyState === 'complete') cuandoHayaTiempo(arrancar, { timeout: 2500 });
        else window.addEventListener('load', function () { cuandoHayaTiempo(arrancar, { timeout: 2500 }); });
      }
    }
  }

  /* ---------- mapa bajo demanda ----------
     El embed de Google pesa unos 430 KB de scripts. Lo insertamos cuando
     está por entrar en pantalla; si no hay IntersectionObserver, al toque. */
  var mapa = document.querySelector('[data-mapa]');
  if (mapa) {
    var insertar = function () {
      if (mapa.dataset.listo) return;
      mapa.dataset.listo = '1';
      var f = document.createElement('iframe');
      f.src = mapa.getAttribute('data-mapa');
      f.title = 'Mapa de Las Cuevas, Diamante, Entre Ríos';
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      mapa.appendChild(f);
    };
    if ('IntersectionObserver' in window) {
      var mio = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) {
          insertar();
          mio.disconnect();
        }
      }, { rootMargin: '300px' });
      mio.observe(mapa);
    } else {
      insertar();
    }
  }

  /* ---------- año del footer ---------- */
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
