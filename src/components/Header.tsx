import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../lib/store';
import { Logo } from './Logo';
import { NavDrawer } from './NavDrawer';
import { HeartIcon, MenuIcon, SearchIcon } from './icons';

export function Header() {
  const navigate = useNavigate();
  const { wishlistCount, cartCount, openEnquiry, notify } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [term, setTerm] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    navigate(term.trim() ? `/shop?q=${encodeURIComponent(term.trim())}` : '/shop');
  };

  /** An enquiry always names a saree, so an empty list sends the customer shopping. */
  const startEnquiry = () => {
    if (!cartCount) {
      notify('Open a saree you love and tap Enquire — every enquiry is for one particular saree.', 'info');
      navigate('/shop');
      return;
    }
    openEnquiry();
  };

  return (
    <>
      <header className="header">
        <div className="container header__inner">
          <button className="header__menu" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <MenuIcon size={20} />
            <span>Menu</span>
          </button>

          <Logo />

          <div className="header__right">
            <form className="header__search" onSubmit={submit} role="search">
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search sarees..."
                aria-label="Search sarees"
              />
              <button className="icon-btn" type="submit" aria-label="Search">
                <SearchIcon size={15} />
              </button>
            </form>

            <Link to="/wishlist" className="header__icon" aria-label={`Wishlist, ${wishlistCount} items`}>
              <HeartIcon size={19} filled={wishlistCount > 0} />
              {wishlistCount > 0 && <span className="header__badge">{wishlistCount}</span>}
            </Link>

            <button
              className="header__login header__enquiry"
              onClick={startEnquiry}
              aria-label={cartCount ? `Your enquiry, ${cartCount} saree${cartCount > 1 ? 's' : ''}` : 'Your enquiry — pick a saree first'}
            >
              <span>Enquiry</span>
              {cartCount > 0 && <b className="header__badge">{cartCount}</b>}
            </button>
          </div>
        </div>
      </header>

      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
