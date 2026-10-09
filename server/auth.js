import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from './env.js';
import { one, q } from './db.js';

export const newId = () => crypto.randomUUID();

export const hashPassword = (plain) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export async function ensureAdminUser() {
  const existing = await one('select id from admin_users where email = $1', [config.adminEmail]);
  if (existing) return existing;
  const id = newId();
  await q(
    'insert into admin_users (id, email, name, password_hash, role) values ($1, $2, $3, $4, $5)',
    [id, config.adminEmail, 'Store Admin', await hashPassword(config.adminPassword), 'admin'],
  );
  return { id };
}

/** Express middleware guarding every /api/admin route. */
export async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await one('select id, email, name, role from admin_users where id = $1', [payload.sub]);
    if (!user) return res.status(401).json({ error: 'Session no longer valid' });
    req.admin = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired, please sign in again' });
  }
}
