import { Link } from 'react-router-dom';
import { inr, stockLabel } from '../lib/format';
import { useApp } from '../lib/store';
import type { Product } from '../lib/types';
import { HeartIcon, WhatsAppIcon } from './icons';

export function ProductCard({ product, flag }: { product: Product; flag?: string }) {
  const { isWished, toggleWish, enquireAbout, notify } = useApp();
  const wished = isWished(product.id);
  const stock = stockLabel(product);
  const image = product.images[0] || '/images/paithani-1.svg';

  const enquire = () => {
    enquireAbout(product);
    notify(`Enquiry started for ${product.name}`, 'success');
  };

  return (
    <article className="product-card">
      <Link to={`/shop/${product.slug}`} className="product-card__media" aria-label={product.name}>
        <img src={image} alt={product.name} loading="lazy" decoding="async" />
        {flag && <span className={`product-card__flag${flag === 'New' ? ' product-card__flag--gold' : ''}`}>{flag}</span>}
      </Link>

      <button
        className={`product-card__wish${wished ? ' is-on' : ''}`}
        onClick={() => toggleWish(product)}
        aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}
      >
        <HeartIcon size={16} filled={wished} />
      </button>

      <div className="product-card__body">
        <span className="product-card__meta">
          {(product.collection_slug || 'paithani').replace(/-/g, ' ')}
          {product.fabric ? ` · ${product.fabric}` : ''}
        </span>
        <h3 className="product-card__name">
          <Link to={`/shop/${product.slug}`}>{product.name}</Link>
        </h3>
        <span className="product-card__price">
          {product.price_on_request ? `From ${inr(product.price)}` : inr(product.price)}
          {product.compare_at_price && product.compare_at_price > product.price && (
            <s>{inr(product.compare_at_price)}</s>
          )}
        </span>
        <span className={`product-card__stock ${stock.tone}`}>{stock.text}</span>

        <div className="product-card__actions">
          <button className="btn btn--sm" onClick={enquire}>
            <WhatsAppIcon size={14} /> Enquire
          </button>
          <Link className="btn btn--outline btn--sm" to={`/shop/${product.slug}`}>
            Details
          </Link>
        </div>
      </div>
    </article>
  );
}
