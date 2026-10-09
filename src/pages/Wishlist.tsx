import { Link } from 'react-router-dom';
import { inrRaw, stockLabel } from '../lib/format';
import { useApp } from '../lib/store';
import { HeartIcon, TrashIcon } from '../components/icons';

export function Wishlist() {
  const { wishlist, toggleWish, clearWishlist, addToEnquiry, openEnquiry, notify } = useApp();

  const enquireAll = () => {
    if (!wishlist.length) return;
    wishlist.forEach((product) => addToEnquiry(product));
    notify(`Enquiry started for ${wishlist.length} saved saree${wishlist.length > 1 ? 's' : ''}`, 'success');
    openEnquiry();
  };

  const total = wishlist.reduce((sum, product) => sum + product.price, 0);

  return (
    <div className="section">
      <div className="container">
        <div className="row row--between row--wrap">
          <div>
            <span className="eyebrow">Saved pieces</span>
            <h1 style={{ marginTop: '0.3rem' }}>Your Wishlist ({wishlist.length})</h1>
          </div>
          {wishlist.length > 0 && (
            <div className="row">
              <button className="btn btn--outline btn--sm" onClick={clearWishlist}>
                <TrashIcon size={14} /> Clear all
              </button>
              <button className="btn btn--sm" onClick={enquireAll}>
                Enquire about all {wishlist.length}
              </button>
            </div>
          )}
        </div>

        {wishlist.length ? (
          <>
            <div className="table-wrap" style={{ marginTop: '1.8rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Saree</th>
                    <th>Fabric</th>
                    <th>Availability</th>
                    <th>From</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {wishlist.map((product) => {
                    const stock = stockLabel(product);
                    return (
                      <tr key={product.id}>
                        <td>
                          <div className="row" style={{ gap: '0.8rem' }}>
                            <img className="thumb" src={product.images[0] || '/images/paithani-1.svg'} alt={product.name} />
                            <div>
                              <Link to={`/shop/${product.slug}`}><strong>{product.name}</strong></Link>
                              <div className="muted small">{product.collection_slug?.replace(/-/g, ' ')}</div>
                            </div>
                          </div>
                        </td>
                        <td className="small">{product.fabric || '—'}</td>
                        <td><span className={`product-card__stock ${stock.tone}`}>{stock.text}</span></td>
                        <td>{inrRaw(product.price)}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="btn btn--sm"
                              onClick={() => {
                                addToEnquiry(product);
                                openEnquiry();
                              }}
                            >
                              Enquire
                            </button>
                            <button className="icon-btn" onClick={() => toggleWish(product)} aria-label="Remove from wishlist">
                              <TrashIcon size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="row row--between row--wrap" style={{ marginTop: '1.2rem' }}>
              <span className="muted small">
                {wishlist.length} saved · estimated value {inrRaw(total)} (final price confirmed by our studio)
              </span>
              <Link className="btn btn--outline btn--sm" to="/shop">Continue browsing</Link>
            </div>
          </>
        ) : (
          <div className="empty" style={{ marginTop: '1.8rem' }}>
            <HeartIcon size={30} />
            <h3>Nothing saved yet</h3>
            <p className="muted">Tap the heart on any saree to keep it here while you decide.</p>
            <Link className="btn" to="/shop">Browse the collection</Link>
          </div>
        )}
      </div>
    </div>
  );
}
