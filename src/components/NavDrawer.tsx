import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { telHref, titleCase, whatsappChatUrl } from '../lib/format';
import { useApp } from '../lib/store';
import type { Collection, Facets } from '../lib/types';
import { Logo } from './Logo';
import { CloseIcon, HeartIcon, PlusIcon, SearchIcon, WhatsAppIcon } from './icons';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NavDrawer({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { wishlistCount, cartCount, openEnquiry, notify, settings } = useApp();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open || collections.length) return;
    api
      .collections()
      .then((data) => setCollections(data.collections))
      .catch(() => undefined);
    api
      .facets()
      .then(setFacets)
      .catch(() => undefined);
  }, [open, collections.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!search.trim()) return;
    go(`/shop?q=${encodeURIComponent(search.trim())}`);
  };

  const startEnquiry = () => {
    if (!cartCount) {
      notify('Open a saree you love and tap Enquire — every enquiry is for one particular saree.', 'info');
      go('/shop');
      return;
    }
    onClose();
    openEnquiry();
  };

  return (
    <>
      <button className="drawer__scrim" aria-label="Close menu" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Main menu">
        <div className="drawer__head">
          <button className="drawer__close" onClick={onClose} aria-label="Close menu">
            <CloseIcon />
          </button>
          <Logo />
        </div>

        <nav className="drawer__nav">
          <Link className="drawer__link" to="/" onClick={onClose}>
            Home
          </Link>

          <details className="drawer__group" open>
            <summary>
              Shop By
              <PlusIcon size={14} className="drawer__plus" />
            </summary>
            <div className="drawer__sub">
              {collections.map((collection) => (
                <Link key={collection.id} to={`/shop?collection=${collection.slug}`} onClick={onClose}>
                  {collection.name}
                  <span className="muted small"> · {collection.product_count}</span>
                </Link>
              ))}
              {!collections.length && <span className="muted small" style={{ padding: '0 2.2rem' }}>Loading…</span>}
            </div>
          </details>

          <details className="drawer__group">
            <summary>
              Accessories
              <PlusIcon size={14} className="drawer__plus" />
            </summary>
            <div className="drawer__sub">
              <Link to="/shop?collection=accessories" onClick={onClose}>Blouse Pieces</Link>
              <Link to="/shop?collection=accessories" onClick={onClose}>Brocade Purses</Link>
              <Link to="/shop?collection=accessories" onClick={onClose}>Zari Stoles</Link>
              <Link to="/shop?collection=accessories" onClick={onClose}>Gift Packaging</Link>
            </div>
          </details>

          <details className="drawer__group">
            <summary>
              Occasion
              <PlusIcon size={14} className="drawer__plus" />
            </summary>
            <div className="drawer__sub">
              {(facets?.occasions || []).map((item) => (
                <Link key={item.value} to={`/shop?occasion=${encodeURIComponent(item.value)}`} onClick={onClose}>
                  {titleCase(item.value)}
                </Link>
              ))}
            </div>
          </details>

          <Link className="drawer__link" to="/shop?best_seller=true" onClick={onClose}>
            Best Seller
          </Link>
          <Link className="drawer__link" to="/shop?new_arrival=true" onClick={onClose}>
            New Arrival
          </Link>
          <Link className="drawer__link" to="/legacy" onClick={onClose}>
            Our Legacy
          </Link>
          <Link className="drawer__link" to="/exhibitions" onClick={onClose}>
            Exhibitions
          </Link>

          <details className="drawer__group">
            <summary>
              Shop By Range
              <PlusIcon size={14} className="drawer__plus" />
            </summary>
            <div className="drawer__sub">
              {(facets?.ranges || []).map((item) => (
                <Link key={item.value} to={`/shop?range=${encodeURIComponent(item.value)}`} onClick={onClose}>
                  {titleCase(item.value)}
                </Link>
              ))}
            </div>
          </details>

          <div className="drawer__actions">
            <button className="btn btn--outline btn--sm" onClick={startEnquiry}>
              <WhatsAppIcon size={15} /> Enquiry ({cartCount})
            </button>
            <button className="btn btn--outline btn--sm" onClick={() => go('/wishlist')}>
              <HeartIcon size={15} /> Wishlist ({wishlistCount})
            </button>
          </div>

          <form className="drawer__search" onSubmit={(event) => { event.preventDefault(); submitSearch(event); }}>
            <input
              className="input"
              placeholder="Search sarees..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search sarees"
            />
            <button className="btn btn--outline btn--sm" type="submit" aria-label="Search">
              <SearchIcon size={15} />
            </button>
          </form>
        </nav>

        <div className="drawer__foot">
          <h4>Need help?</h4>
          <p>{settings?.store_address || 'Sonali Handlooms, Yeola, Nashik - 423401'}</p>
          <p>
            Ph - <a href={telHref(settings?.store_phone || '919822055443')}>+{settings?.store_phone || '919822055443'}</a>
            {' · '}
            <a href={`mailto:${settings?.store_email || 'yeola@sonalipaithani.com'}`}>
              {settings?.store_email || 'yeola@sonalipaithani.com'}
            </a>
          </p>
          {settings?.store_whatsapp && (
            <p>
              <a href={whatsappChatUrl(settings.store_whatsapp, 'Namaskar! I have a question about your Paithani sarees.')} target="_blank" rel="noreferrer">
                Chat with our studio on WhatsApp →
              </a>
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
