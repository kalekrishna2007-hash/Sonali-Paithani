import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { telHref, whatsappChatUrl } from '../lib/format';
import { useApp } from '../lib/store';
import { Header } from './Header';
import { Logo } from './Logo';
import { EnquiryDialog } from './EnquiryDialog';
import { Toasts } from './Toasts';
import { WhatsAppIcon } from './icons';

export function StoreLayout({ children }: { children: ReactNode }) {
  const { settings } = useApp();
  const [fabOpen, setFabOpen] = useState(false);

  const phone = settings?.store_phone || '919822055443';
  const whatsapp = settings?.store_whatsapp || phone;

  return (
    <>
      <a className="btn btn--outline btn--sm" href="#main" style={{ position: 'absolute', left: '-9999px' }}>
        Skip to content
      </a>
      <Header />
      <main id="main">{children}</main>

      <footer className="footer">
        <div className="container footer__grid">
          <div>
            <Logo />
            <p style={{ marginTop: '1rem', maxWidth: '22rem' }}>
              {settings?.store_tagline || 'A legacy in every weave'} — handwoven Paithani sarees from Yeola, Nashik,
              since 1978.
            </p>
          </div>

          <div>
            <h4>Shop</h4>
            <ul>
              <li><Link to="/shop">All Sarees</Link></li>
              <li><Link to="/shop?collection=traditional-paithani">Traditional Paithani</Link></li>
              <li><Link to="/shop?collection=bridal-collection">Bridal Collection</Link></li>
              <li><Link to="/shop?collection=contemporary-paithani">Contemporary</Link></li>
              <li><Link to="/shop?collection=sarees-by-color">Sarees by Color</Link></li>
            </ul>
          </div>

          <div>
            <h4>Explore</h4>
            <ul>
              <li><Link to="/legacy">Our Legacy</Link></li>
              <li><Link to="/exhibitions">Exhibitions</Link></li>
              <li><Link to="/wishlist">Your Wishlist</Link></li>
              <li><Link to="/track">Track an Enquiry</Link></li>
              <li><Link to="/admin">Store Staff Login</Link></li>
              <li><a href={whatsappChatUrl(whatsapp, 'Namaskar! I need help choosing a Paithani.')} target="_blank" rel="noreferrer">WhatsApp Us</a></li>
            </ul>
          </div>

          <div>
            <h4>Visit the studio</h4>
            <ul>
              <li>{settings?.store_address || 'Sonali Handlooms, Yeola, Nashik - 423401'}</li>
              <li><a href={telHref(phone)}>Ph - +{phone}</a></li>
              <li><a href={`mailto:${settings?.store_email || 'yeola@sonalipaithani.com'}`}>{settings?.store_email || 'yeola@sonalipaithani.com'}</a></li>
              <li>Mon – Sat, 10:00 – 19:00 IST</li>
            </ul>
          </div>
        </div>

        <div className="container footer__bottom">
          <span>© {new Date().getFullYear()} Sonali Handlooms, Yeola. All rights reserved.</span>
          <span>Handloom mark · Silk mark certified · Made in Maharashtra, India</span>
        </div>
      </footer>

      <div style={{ position: 'fixed', right: '1.5rem', bottom: '1.5rem', zIndex: 70 }}>
        {fabOpen && (
          <div className="card" style={{ marginBottom: '0.6rem', width: '250px' }}>
            <strong style={{ display: 'block', marginBottom: '0.4rem' }}>Talk to our studio</strong>
            <p className="help" style={{ marginBottom: '0.7rem' }}>
              Share your occasion and budget — we will send a curated video of available pieces.
            </p>
            <a
              className="btn btn--sm btn--block"
              href={whatsappChatUrl(whatsapp, 'Namaskar! Please share available Paithani sarees with price.')}
              target="_blank"
              rel="noreferrer"
            >
              <WhatsAppIcon size={15} /> Open WhatsApp
            </a>
            <a className="btn btn--outline btn--sm btn--block" style={{ marginTop: '0.4rem' }} href={telHref(phone)}>
              Call +{phone}
            </a>
          </div>
        )}
        <button className="fab" onClick={() => setFabOpen((value) => !value)} aria-label="Contact us on WhatsApp">
          <WhatsAppIcon size={24} />
        </button>
      </div>

      <EnquiryDialog />
      <Toasts />
    </>
  );
}
