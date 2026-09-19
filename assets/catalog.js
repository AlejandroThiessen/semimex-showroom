(function (root) {
  'use strict';
  const normalize = (text) => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  function filter(vehicles, values = {}, sort = 'recent') {
    const terms = normalize(values.q || '').split(/\s+/).filter(Boolean);
    const matches = vehicles.filter((car) =>
      (!values.tipo || car.category === values.tipo) &&
      (!values.marca || car.brand === values.marca) &&
      (!values.presupuesto || (car.price > 0 && car.price <= Number(values.presupuesto))) &&
      terms.every((term) => normalize(car.title).includes(term))
    );
    if (sort === 'price-asc') matches.sort((a,b) => (a.price || Infinity) - (b.price || Infinity));
    if (sort === 'price-desc') matches.sort((a,b) => (b.price || 0) - (a.price || 0));
    if (sort === 'year-desc') matches.sort((a,b) => (b.year || 0) - (a.year || 0));
    return matches;
  }
  const api = {filter};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SemiMexCatalog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
