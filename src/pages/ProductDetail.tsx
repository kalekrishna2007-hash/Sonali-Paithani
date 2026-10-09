import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { inr, inrRaw, stockLabel, whatsappChatUrl } from '../lib/format';
import { useApp } from '../lib/store';
import { useAsync } from '../lib/useAsync';
import { ProductCard } from '../components/ProductCard';
import { HeartIcon, TruckIcon, WhatsAppIcon } from '../components/icons';

export function ProductDetail() {
  const { slug = '' } = useParams();
  const { enquireAbout, isWished, toggleWish, notify, settings } = useApp();
  const { data, loading, error } = useAsync(() => api.product(slug), [slug]);

  const product = data?.product;
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');

  useEffect(() => {
    setActiveImage(0);
    setQuantity(1);
    setSize(product?.sizes[0] || '');
    setColor(product?.colors[0] || '');
  }, [product]);

  if (loading) {
    return (
      <div className="section container">
        <div className="pdp">
          <div className="skeleton" style={{ aspectRatio: '3 / 4' }} />
          <div className="stack">
            <div className="skeleton" style={{ height: '2.4rem' }} />
            <div className="skeleton" style={{ height: '6rem' }} />
            <div className="skeleton" style={{ height: '3rem' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="section container">
        <div className="empty">
          <h3>This saree is no longer available</h3>
          <p className="muted">{error || 'It may have been sold or withdrawn from the catalogue.'}</p>
          <Link className="btn btn--outline" to="/shop">Back to the collection</Link>
        </div>
      </div>
    );
  }

  const stock = stockLabel(product);
  const gallery = product.images.length ? product.images : ['/images/paithani-1.svg'];
  const wished = isWished(product.id);

  const addAndOpen = () => {
    enquireAbout(product, { quantity, size, color });
  };

  const quickAsk = () => {
    const message = `Namaskar! I am interested in *${product.name}* (${inrRaw(product.price)}).\nSize: ${size || 'to discuss'}\nColour: ${color || 'to discuss'}\nIs it available?`;
    window.open(whatsappChatUrl(settings?.store_whatsapp || '919822055443', message), '_blank', 'noopener');
    notify('Opening WhatsApp…');
  };

  return (
    <div className="section">
      <div className="container">
        <nav className="small muted" style={{ marginBottom: '1.2rem' }}>
          <Link to="/">Home</Link> / <Link to="/shop">Sarees</Link>
          {product.collection_slug && (
            <>
              {' / '}
              <Link to={`/shop?collection=${product.collection_slug}`}>{product.collection_slug.replace(/-/g, ' ')}</Link>
            </>
          )}
          {' / '}
          <span>{product.name}</span>
        </nav>

        <div className="pdp">
          <div className="pdp__gallery">
            <div className="pdp__main">
              <img src={gallery[activeImage] || gallery[0]} alt={product.name} />
            </div>
            {gallery.length > 1 && (
              <div className="pdp__thumbs">
                {gallery.map((image, index) => (
                  <button
                    key={image + index}
                    className={index === activeImage ? 'is-active' : ''}
                    onClick={() => setActiveImage(index)}
                    aria-label={`View image ${index + 1}`}
                  >
                    <img src={image} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <span className="eyebrow">
              {product.collection_slug?.replace(/-/g, ' ') || 'paithani'}
              {product.range_label ? ` · ${product.range_label} range` : ''}
            </span>
            <h1 style={{ marginTop: '0.4rem' }}>{product.name}</h1>
            <p className="muted">{product.short_description}</p>

            <div className="pdp__price">
              {inr(product.price)}
              {product.compare_at_price && product.compare_at_price > product.price && (
                <s className="muted" style={{ fontSize: '1rem', marginLeft: '0.6rem' }}>
                  {inr(product.compare_at_price)}
                </s>
              )}
            </div>
            <span className={`product-card__stock ${stock.tone}`}>{stock.text}</span>
            <p className="help">Price confirmed by our studio after availability check. GST and shipping extra.</p>

            <dl className="pdp__spec">
              {product.fabric && (<><dt>Fabric</dt><dd>{product.fabric}</dd></>)}
              {product.weave && (<><dt>Weave</dt><dd>{product.weave}</dd></>)}
              {product.work && (<><dt>Work</dt><dd>{product.work}</dd></>)}
              {product.dimensions && (<><dt>Dimensions</dt><dd>{product.dimensions}</dd></>)}
              {product.occasion && (<><dt>Best for</dt><dd>{product.occasion}</dd></>)}
              {product.care && (<><dt>Care</dt><dd>{product.care}</dd></>)}
            </dl>

            <div className="form-grid" style={{ marginBottom: '1.2rem' }}>
              <label className="field">
                <span>Quantity</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={20}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                />
              </label>
              <label className="field">
                <span>Size</span>
                <select className="select" value={size} onChange={(event) => setSize(event.target.value)}>
                  <option value="">Any / discuss with studio</option>
                  {product.sizes.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Colour</span>
                <select className="select" value={color} onChange={(event) => setColor(event.target.value)}>
                  <option value="">Any / discuss with studio</option>
                  {product.colors.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="pdp__buy">
              <button className="btn" onClick={addAndOpen}>
                <WhatsAppIcon size={16} /> Enquire about this saree
              </button>
              <button className="btn btn--outline" onClick={quickAsk}>
                Ask on WhatsApp
              </button>
              <button
                className={`btn btn--outline${wished ? ' is-on' : ''}`}
                onClick={() => toggleWish(product)}
                aria-label="Toggle wishlist"
              >
                <HeartIcon size={16} filled={wished} /> {wished ? 'Saved' : 'Wishlist'}
              </button>
            </div>

            <div className="row" style={{ marginTop: '1.4rem', gap: '0.6rem' }}>
              <TruckIcon size={18} />
              <span className="small muted">
                Insured shipping across India & worldwide · Video call before dispatch · Handloom & silk mark certified
              </span>
            </div>

            {product.description && (
              <>
                <h3 style={{ marginTop: '2rem' }}>About this weave</h3>
                <p>{product.description}</p>
              </>
            )}
          </div>
        </div>

        {!!data?.related.length && (
          <section className="section" style={{ paddingBottom: 0 }}>
            <span className="eyebrow">You may also love</span>
            <h2 style={{ marginTop: '0.3rem' }}>From the same collection</h2>
            <div className="product-grid" style={{ marginTop: '1.4rem' }}>
              {data.related.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
