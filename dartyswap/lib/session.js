import crypto from 'crypto';
import { cookies } from 'next/headers';

const DAY = 60 * 60 * 24;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET manquant');
  return s;
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

const NAMES = { resultat: 'ds_resultat', admin: 'ds_admin', student: 'ds_student' };

export function createSession(kind, data = {}, maxAgeSeconds = DAY) {
  const payload = { ...data, k: kind, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds };
  cookies().set(NAMES[kind], sign(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  });
}

export function readSession(kind) {
  const c = cookies().get(NAMES[kind]);
  const payload = verify(c?.value);
  if (!payload || payload.k !== kind) return null;
  return payload;
}

export function destroySession(kind) {
  cookies().set(NAMES[kind], '', { httpOnly: true, path: '/', maxAge: 0 });
}

/** Comparaison à temps constant, pour les mots de passe. */
export function safeEqual(a, b) {
  const ba = Buffer.from(String(a ?? ''));
  const bb = Buffer.from(String(b ?? ''));
  if (ba.length !== bb.length) {
    // On compare quand même, pour ne pas révéler la longueur par le timing.
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

/** Code personnel étudiant : lisible, sans caractères ambigus. */
export function generateStudentCode() {
  const alphabet = 'ACDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}
