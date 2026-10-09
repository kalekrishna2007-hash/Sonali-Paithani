import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, tokenStore } from '../lib/api';
import { Logo } from '../components/Logo';

export function AdminLogin({ onSignedIn }: { onSignedIn: (admin: { id: string; email: string; name: string }) => void }) {
  const [email, setEmail] = useState('admin@sonalipaithani.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await adminApi.login(email.trim(), password);
      tokenStore.set(data.token);
      onSignedIn(data.admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login">
      <form className="admin-login__card" onSubmit={submit}>
        <div className="center" style={{ marginBottom: '1.4rem' }}>
          <Logo />
          <h2 style={{ marginTop: '0.8rem', marginBottom: 0 }}>Studio dashboard</h2>
          <p className="muted small" style={{ margin: 0 }}>Sign in to manage enquiries, products and stock.</p>
        </div>

        <div className="stack">
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" />
          </label>
          <label className="field">
            <span>Password</span>
            <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" autoFocus />
          </label>
        </div>

        {error && <p className="field__error" style={{ marginTop: '0.8rem' }}>{error}</p>}

        <button className="btn btn--block" type="submit" style={{ marginTop: '1.2rem' }} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="help center" style={{ marginTop: '1rem' }}>
          First run? The credentials in <code>server/.env</code> (ADMIN_EMAIL / ADMIN_PASSWORD) are used to create the
          account automatically. <Link to="/">Back to storefront</Link>
        </p>
      </form>
    </div>
  );
}
