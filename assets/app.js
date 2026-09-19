(() => {
  'use strict';
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const mobileMenu = $('.mobile-menu');
  if (mobileMenu) {
    mobileMenu.addEventListener('click', (event) => {
      if (event.target.closest('a')) mobileMenu.open = false;
    });
    document.addEventListener('click', (event) => {
      if (mobileMenu.open && !mobileMenu.contains(event.target)) mobileMenu.open = false;
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && mobileMenu.open) {
        mobileMenu.open = false;
        $('summary', mobileMenu).focus();
      }
    });
  }

  const inventory = $('[data-inventory]');
  if (inventory) {
    const form = $('#inventory-filters');
    const grid = $('#inventory-grid');
    const cards = $$('.car-card', grid).map((el, index) => ({
      el, index, slug: el.dataset.vehicle, title: el.dataset.search,
      category: el.dataset.category, brand: el.dataset.brand,
      year: Number(el.dataset.year), price: Number(el.dataset.price),
    }));
    const fields = ['q', 'tipo', 'marca', 'presupuesto'];
    const perPage = 12;
    let visible = perPage;
    let filtered = cards;
    let inputTimer;

    function readURL() {
      const params = new URLSearchParams(location.search);
      fields.forEach((field) => {
        form.elements[field].value = params.get(field) ?? (field === 'tipo' ? inventory.dataset.initialCategory : '');
      });
      $('#sort').value = params.get('orden') || 'recent';
      if (!$('#sort').value) $('#sort').value = 'recent';
    }

    function syncURL() {
      const url = new URL(location.href);
      fields.forEach((field) => {
        const value = form.elements[field].value.trim();
        if (value) url.searchParams.set(field, value);
        else url.searchParams.delete(field);
      });
      if ($('#sort').value !== 'recent') url.searchParams.set('orden', $('#sort').value);
      else url.searchParams.delete('orden');
      // Preserve the chosen empty category when clearing a category landing page.
      if (inventory.dataset.initialCategory && !form.elements.tipo.value) url.searchParams.set('tipo', '');
      history.replaceState(null, '', url);
    }

    function render(updateURL = true, resetPage = true) {
      if (resetPage) visible = perPage;
      const values = Object.fromEntries(fields.map((field) => [field, form.elements[field].value.trim()]));
      filtered = window.SemiMexCatalog.filter(cards, values, $('#sort').value);
      const shown = new Set(filtered.slice(0, visible));
      cards.forEach((car) => { car.el.hidden = !shown.has(car); });
      filtered.forEach((car) => grid.appendChild(car.el));
      $('#result-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'vehículo encontrado' : 'vehículos encontrados'}`;
      $('#shown-count').textContent = filtered.length ? `Mostrando ${Math.min(visible, filtered.length)} de ${filtered.length} vehículos` : '';
      $('#load-more').hidden = visible >= filtered.length;
      $('#empty-state').hidden = filtered.length !== 0;
      $('#reset-filters').hidden = !fields.some((field) => values[field]);
      $$('[data-category-chip]').forEach((chip) => {
        const active = chip.dataset.categoryChip === values.tipo;
        chip.classList.toggle('selected', active);
        chip.setAttribute('aria-pressed', String(active));
      });
      if (updateURL) syncURL();
      return filtered;
    }

    function reset() {
      fields.forEach((field) => { form.elements[field].value = ''; });
      $('#sort').value = 'recent';
      render();
    }
    form.addEventListener('submit', (event) => { event.preventDefault(); clearTimeout(inputTimer); render(); });
    $$('select', form).forEach((select) => select.addEventListener('change', () => render()));
    form.elements.q.addEventListener('input', () => { clearTimeout(inputTimer); inputTimer = setTimeout(() => render(), 160); });
    $('#sort').addEventListener('change', () => render());
    $('#reset-filters').addEventListener('click', reset);
    $('#empty-reset').addEventListener('click', reset);
    $('#load-more').addEventListener('click', () => {
      const next = filtered[visible];
      visible += perPage;
      render(false, false);
      $('a', next?.el || grid)?.focus({preventScroll:true});
    });
    $$('[data-category-chip]').forEach((chip) => chip.addEventListener('click', () => { form.elements.tipo.value = chip.dataset.categoryChip; render(); }));
    window.addEventListener('popstate', () => { readURL(); render(false); });
    readURL();
    render(false);

    // Progressive WebMCP enhancement. It uses the same filters and rendering as the UI.
    if (document.modelContext?.registerTool) {
      const lifecycle = new AbortController();
      const tool = {
        name: 'filter_semimex_inventory',
        title: 'Filtrar vehículos SemiMex',
        description: 'Aplica filtros al catálogo visible. Devuelve coincidencias publicadas; la disponibilidad debe confirmarse con SemiMex.',
        inputSchema: {type:'object', properties:{query:{type:'string',maxLength:100},category:{type:'string',enum:['','Pick-up','SUV','Sedán','Hatchback','Convertible','MPV']},brand:{type:'string'},maxPrice:{type:'integer',enum:[300000,500000,800000,1200000,2000000]}},additionalProperties:false},
        annotations: {readOnlyHint:false,untrustedContentHint:true},
        execute(input) {
          if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Se requieren filtros válidos.');
          if (Object.keys(input).some((key) => !['query','category','brand','maxPrice'].includes(key))) throw new Error('Filtro desconocido.');
          if (input.query !== undefined && (typeof input.query !== 'string' || input.query.length > 100)) throw new Error('Búsqueda inválida.');
          const validOption = (field,value) => Array.from(form.elements[field].options).some((o) => o.value === String(value));
          if (input.category !== undefined && !validOption('tipo',input.category)) throw new Error('Tipo de vehículo inválido.');
          if (input.brand !== undefined && !validOption('marca',input.brand)) throw new Error('Marca inválida.');
          if (input.maxPrice !== undefined && (!Number.isInteger(input.maxPrice) || !validOption('presupuesto',input.maxPrice))) throw new Error('Presupuesto inválido.');
          form.elements.q.value = input.query || '';
          form.elements.tipo.value = input.category || '';
          form.elements.marca.value = input.brand || '';
          form.elements.presupuesto.value = input.maxPrice ? String(input.maxPrice) : '';
          const results = render();
          return {total:results.length,vehicles:results.slice(0,12).map(({title,price,category,slug})=>({title,price:price||null,currency:'MXN',category,url:`/semimex-showroom/cars/${slug}/`}))};
        }
      };
      try { Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(() => {}); } catch { /* Unsupported implementations leave the normal UI intact. */ }
      window.addEventListener('pagehide', () => lifecycle.abort(), {once:true});
    }
  }

  if ($('[data-gallery]')) {
    const thumbs = $$('.gallery-thumb');
    const mainImage = $('#gallery-image');
    const dialog = $('#lightbox');
    const expandedImage = $('#lightbox-image');
    let current = 0;
    function show(index) {
      current = (index + thumbs.length) % thumbs.length;
      const link = thumbs[current];
      mainImage.src = link.href;
      mainImage.alt = $('img', link).alt;
      $('#gallery-expand').href = link.href;
      expandedImage.src = link.href;
      expandedImage.alt = mainImage.alt;
      const label = `${current + 1} / ${thumbs.length}`;
      $('#gallery-count').textContent = label;
      $('#lightbox-count').textContent = label;
      thumbs.forEach((thumb,i) => {
        thumb.classList.toggle('selected', i === current);
        if (i === current) thumb.setAttribute('aria-current','true');
        else thumb.removeAttribute('aria-current');
      });
    }
    thumbs.forEach((thumb,i) => thumb.addEventListener('click', (event) => {event.preventDefault();show(i);}));
    $('#gallery-prev').addEventListener('click', () => show(current-1));
    $('#gallery-next').addEventListener('click', () => show(current+1));
    $('#gallery-expand').addEventListener('click', (event) => {
      if (typeof dialog.showModal !== 'function') return;
      event.preventDefault();show(current);dialog.showModal();document.body.classList.add('modal-open');
    });
    $('.lightbox-close').addEventListener('click', () => dialog.close());
    $('.lightbox-prev').addEventListener('click', () => show(current-1));
    $('.lightbox-next').addEventListener('click', () => show(current+1));
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {document.body.classList.remove('modal-open');$('#gallery-expand').focus();});
    document.addEventListener('keydown', (event) => {
      if (!dialog.open && !$('[data-gallery]').contains(document.activeElement)) return;
      if (event.key === 'ArrowLeft') {event.preventDefault();show(current-1);}
      if (event.key === 'ArrowRight') {event.preventDefault();show(current+1);}
    });
    // Only deliberate one-finger horizontal gestures change the photo.
    // Keep page scrolling, pinch zoom, and a normal tap to expand available.
    function enableSwipe(surface) {
      let start = null;
      let horizontal = false;
      let suppressClickUntil = 0;
      surface.addEventListener('touchstart', (event) => {
        suppressClickUntil = 0;
        horizontal = false;
        start = event.touches.length === 1
          ? {x:event.touches[0].clientX, y:event.touches[0].clientY}
          : null;
      }, {passive:true});
      surface.addEventListener('touchmove', (event) => {
        if (!start) return;
        if (event.touches.length !== 1) { start = null; return; }
        const dx = event.touches[0].clientX - start.x;
        const dy = event.touches[0].clientY - start.y;
        if (!horizontal && Math.max(Math.abs(dx), Math.abs(dy)) >= 12) {
          if (Math.abs(dx) <= Math.abs(dy) * 1.3) { start = null; return; }
          horizontal = true;
        }
        if (horizontal && event.cancelable) event.preventDefault();
      }, {passive:false});
      surface.addEventListener('touchend', (event) => {
        if (!start || event.touches.length || !event.changedTouches.length) {
          start = null;
          return;
        }
        const dx = event.changedTouches[0].clientX - start.x;
        const dy = event.changedTouches[0].clientY - start.y;
        start = null;
        const swiped = Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.3;
        if (horizontal || swiped) suppressClickUntil = Date.now() + 500;
        if (swiped) show(current + (dx < 0 ? 1 : -1));
      }, {passive:true});
      surface.addEventListener('touchcancel', () => {
        start = null;
        if (horizontal) suppressClickUntil = Date.now() + 500;
      }, {passive:true});
      surface.addEventListener('click', (event) => {
        if (event.detail !== 0 && Date.now() < suppressClickUntil) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }, {capture:true});
    }
    if (thumbs.length > 1) {
      enableSwipe($('#gallery-expand'));
      enableSwipe(expandedImage);
    }
    if (thumbs.length < 2) {
      $('#gallery-prev').hidden = true;$('#gallery-next').hidden = true;
      $('.lightbox-prev').hidden = true;$('.lightbox-next').hidden = true;
    }
  }

  const contactForm = $('#contact-form');
  if (contactForm) {
    const vehicle = new URLSearchParams(location.search).get('vehiculo');
    if (vehicle) {
      $('#subject').value = `Consulta: ${vehicle}`.slice(0,180);
      $('#message').value = `Hola, me interesa ${vehicle.slice(0,200)}. ¿Podrían confirmarme su disponibilidad y compartirme más información?`;
    }
    contactForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!contactForm.reportValidity()) return;
      const body = `Nombre: ${$('#name').value.trim()}\nCorreo: ${$('#email').value.trim()}\n\n${$('#message').value.trim()}`;
      const subject = $('#subject').value.trim();
      $('#prepared-message').value = `Asunto: ${subject}\n\n${body}`;
      $('#contact-result').hidden = false;
      location.href = `mailto:info@semimex.com.mx?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
    $('#copy-message').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText($('#prepared-message').value);
        $('#copy-status').textContent = ' Consulta copiada.';
      } catch {
        $('#prepared-message').focus();$('#prepared-message').select();
        $('#copy-status').textContent = ' Selecciona y copia el texto.';
      }
    });
  }
})();
