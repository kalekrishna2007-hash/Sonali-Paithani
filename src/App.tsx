import { Link, Route, Routes } from 'react-router-dom';
import { StoreLayout } from './components/Layout';
import { Home } from './pages/Home';
import { Shop } from './pages/Shop';
import { ProductDetail } from './pages/ProductDetail';
import { Wishlist } from './pages/Wishlist';
import { Track } from './pages/Track';
import { Legacy } from './pages/Legacy';
import { Exhibitions } from './pages/Exhibitions';
import { AdminApp } from './admin/AdminApp';

function NotFound() {
  return (
    <div className="section container center">
      <h1>Page not found</h1>
      <p className="muted">The page you were looking for has moved or never existed.</p>
      <Link className="btn" to="/">Back to the storefront</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<AdminApp />} />
      <Route
        path="*"
        element={
          <StoreLayout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/shop/:slug" element={<ProductDetail />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/track" element={<Track />} />
              <Route path="/legacy" element={<Legacy />} />
              <Route path="/exhibitions" element={<Exhibitions />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </StoreLayout>
        }
      />
    </Routes>
  );
}
