import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { adminApi, tokenStore } from '../lib/api';
import { Toasts } from '../components/Toasts';
import { Logo } from '../components/Logo';
import { BoxIcon, CogIcon, DiamondIcon, HomeIcon, InboxIcon, LogoutIcon, LoomIcon } from '../components/icons';
import { AdminLogin } from './AdminLogin';
import { Dashboard } from './Dashboard';
import { AdminProducts } from './AdminProducts';
import { AdminEnquiries } from './AdminEnquiries';
import { AdminLegacy, AdminExhibitions } from './AdminContent';
import { AdminSettings } from './AdminSettings';

type Status = 'checking' | 'guest' | 'authed';

export function AdminApp() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('checking');
  const [admin, setAdmin] = useState<{ email: string; name: string } | null>(null);

  useEffect(() => {
    if (!tokenStore.get()) {
      setStatus('guest');
      return;
    }
    adminApi
      .me()
      .then((data) => {
        setAdmin(data.admin);
        setStatus('authed');
      })
      .catch(() => setStatus('guest'));
  }, []);

  if (status === 'checking') {
    return (
      <div className="admin-login">
        <div className="admin-login__card center">
          <Logo />
          <p className="muted" style={{ marginTop: '1rem' }}>Checking your session…</p>
        </div>
      </div>
    );
  }

  if (status === 'guest') {
    return (
      <>
        <AdminLogin
          onSignedIn={(next) => {
            setAdmin(next);
            setStatus('authed');
            navigate('/admin');
          }}
        />
        <Toasts />
      </>
    );
  }

  const signOut = () => {
    tokenStore.clear();
    setStatus('guest');
  };

  return (
    <div className="admin">
      <aside className="admin__side">
        <Logo to="/admin" compact />
        <NavLink to="/admin" end className={({ isActive }) => `admin__navlink${isActive ? ' is-active' : ''}`}>
          <HomeIcon /> Overview
        </NavLink>
        <NavLink to="/admin/enquiries" className={({ isActive }) => `admin__navlink${isActive ? ' is-active' : ''}`}>
          <InboxIcon /> Enquiries
        </NavLink>
        <NavLink to="/admin/products" className={({ isActive }) => `admin__navlink${isActive ? ' is-active' : ''}`}>
          <BoxIcon /> Products &amp; stock
        </NavLink>
        <NavLink to="/admin/legacy" className={({ isActive }) => `admin__navlink${isActive ? ' is-active' : ''}`}>
          <DiamondIcon /> Our Legacy
        </NavLink>
        <NavLink to="/admin/exhibitions" className={({ isActive }) => `admin__navlink${isActive ? ' is-active' : ''}`}>
          <LoomIcon /> Exhibitions
        </NavLink>
        <NavLink to="/admin/settings" className={({ isActive }) => `admin__navlink${isActive ? ' is-active' : ''}`}>
          <CogIcon /> Settings
        </NavLink>

        <div style={{ marginTop: 'auto', display: 'grid', gap: '0.5rem' }}>
          <NavLink to="/" className="admin__navlink">
            <HomeIcon /> View storefront
          </NavLink>
          <span className="admin__navlink small" style={{ opacity: 0.7 }}>{admin?.email}</span>
          <button className="admin__navlink" onClick={signOut} style={{ background: 'none', border: 0, cursor: 'pointer', width: '100%', textAlign: 'left' }}>
            <LogoutIcon /> Sign out
          </button>
        </div>
      </aside>

      <main className="admin__main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/enquiries" element={<AdminEnquiries />} />
          <Route path="/products" element={<AdminProducts />} />
          <Route path="/legacy" element={<AdminLegacy />} />
          <Route path="/exhibitions" element={<AdminExhibitions />} />
          <Route path="/settings" element={<AdminSettings />} />
        </Routes>
      </main>

      <Toasts />
    </div>
  );
}
