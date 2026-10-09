import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { titleCase } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { ProductCard } from '../components/ProductCard';

const PAGE_SIZE = 12;

const SORTS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest first' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name', label: 'Alphabetical' },
];

export function Shop() {
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState(params.get('q') || '');

  const filters = useMemo(
    () => ({
      q: params.get('q') || '',
      collection: params.get('collection') || '',
      occasion: params.get('occasion') || '',
      range: params.get('range') || '',
      sort: params.get('sort') || 'featured',
      best_seller: params.get('best_seller') === 'true',
      new_arrival: params.get('new_arrival') === 'true',
      in_stock: params.get('in_stock') === 'true',
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [params, page],
  );

  useEffect(() => setPage(0), [params]);

  const { data, loading, error } = useAsync(
    () => api.products({ ...filters, offset: page * PAGE_SIZE }),
    [JSON.stringify(filters)],
  );
  const { data: collectionData } = useAsync(() => api.collections(), []);
  const { data: facets } = useAsync(() => api.facets(), []);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const activeFilters = ['collection', 'occasion', 'range', 'best_seller', 'new_arrival', 'in_stock', 'q'].filter((key) =>
    params.get(key),
  );

  const rows = data?.rows || [];
  const total = data?.total || 0;

  return (
    <div className="section">
      <div className="container">
        <span className="eyebrow">The collection</span>
        <h1 style={{ marginTop: '0.3rem' }}>
          {filters.collection
            ? titleCase(filters.collection)
            : filters.best_seller
              ? 'Best Sellers'
              : filters.new_arrival
                ? 'New Arrivals'
                : 'All Paithani Sarees'}
        </h1>

        <div className="filter-bar">
          <form
            className="row"
            onSubmit={(event) => {
              event.preventDefault();
              setParam('q', searchInput.trim());
            }}
          >
            <input
              className="input"
              style={{ minWidth: '240px' }}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name, colour or motif"
              aria-label="Search sarees"
            />
            <button className="btn btn--outline btn--sm" type="submit">Search</button>
          </form>

          <div className="row row--wrap">
            <label className="field">
              <span>Occasion</span>
              <select className="select" value={filters.occasion} onChange={(event) => setParam('occasion', event.target.value)}>
                <option value="">All occasions</option>
                {(facets?.occasions || []).map((item) => (
                  <option key={item.value} value={item.value}>{titleCase(item.value)}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Range</span>
              <select className="select" value={filters.range} onChange={(event) => setParam('range', event.target.value)}>
                <option value="">All ranges</option>
                {(facets?.ranges || []).map((item) => (
                  <option key={item.value} value={item.value}>{titleCase(item.value)}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Sort</span>
              <select className="select" value={filters.sort} onChange={(event) => setParam('sort', event.target.value)}>
                {SORTS.map((sort) => (
                  <option key={sort.value} value={sort.value}>{sort.label}</option>
                ))}
              </select>
            </label>

            <label className="row" style={{ gap: '0.4rem', paddingBottom: '0.6rem' }}>
              <input
                type="checkbox"
                checked={filters.in_stock}
                onChange={(event) => setParam('in_stock', event.target.checked ? 'true' : '')}
              />
              <span className="small">Ready to ship</span>
            </label>
          </div>
        </div>

        <div className="chips" style={{ marginBottom: '1.6rem' }}>
          <button className={`chip${!filters.collection ? ' is-active' : ''}`} onClick={() => setParam('collection', '')}>
            All
          </button>
          {(collectionData?.collections || []).map((collection) => (
            <button
              key={collection.id}
              className={`chip${filters.collection === collection.slug ? ' is-active' : ''}`}
              onClick={() => setParam('collection', collection.slug)}
            >
              {collection.name} ({collection.product_count})
            </button>
          ))}
        </div>

        <div className="row row--between row--wrap" style={{ marginBottom: '1rem' }}>
          <span className="muted small">
            {loading ? 'Loading…' : `${total} saree${total === 1 ? '' : 's'} found`}
            {activeFilters.length ? ` · ${activeFilters.length} filter${activeFilters.length > 1 ? 's' : ''} applied` : ''}
          </span>
          <div className="row">
            {activeFilters.length > 0 && (
              <button className="btn btn--quiet btn--sm" onClick={() => { setParams(new URLSearchParams()); setSearchInput(''); }}>
                Clear all
              </button>
            )}
          </div>
        </div>

        {error && <div className="empty"><p>{error}</p></div>}

        {loading ? (
          <div className="product-grid">
            {Array.from({ length: 8 }).map((_, key) => (
              <div className="skeleton skeleton--card" key={key} />
            ))}
          </div>
        ) : rows.length ? (
          <div className="product-grid">
            {rows.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                flag={product.is_new_arrival ? 'New' : product.is_best_seller ? 'Bestseller' : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>No sarees match those filters</h3>
            <p className="muted">Try clearing a filter, or ask our studio what is on the loom this month.</p>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="row" style={{ justifyContent: 'center', marginTop: '2rem' }}>
            <button className="btn btn--outline" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
              ← Previous
            </button>
            <span className="muted small">
              Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
            </span>
            <button
              className="btn btn--outline"
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage((value) => value + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
