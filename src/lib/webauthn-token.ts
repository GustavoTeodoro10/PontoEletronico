import { createHmac, timingSafeEqual } from 'crypto';

function secret(): string {
  return process.env.AUTH_SECRET!;
}

export function getRpConfig(): { rpId: string; origin: string } {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const url = new URL(baseUrl);
  return { rpId: url.hostname, origin: url.origin };
}

function hmacSign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('hex');
}

function hmacVerify(data: string, sig: string): boolean {
  const expected = hmacSign(data);
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// ── Challenge cookie ──────────────────────────────────────────────────────────

export function signChallenge(challenge: string, bindTo: string = ''): string {
  const payload = JSON.stringify({ challenge, bindTo, exp: Date.now() + 300_000 });
  const b64 = Buffer.from(payload).toString('base64url');
  return `${b64}.${hmacSign(b64)}`;
}

export function verifyChallengeCookie(cookie: string, expectedBindTo: string = ''): string | null {
  const dot = cookie.lastIndexOf('.');
  if (dot < 0) return null;
  const b64 = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  if (!hmacVerify(b64, sig)) return null;
  try {
    const { challenge, bindTo, exp } = JSON.parse(Buffer.from(b64, 'base64url').toString());
    if (typeof exp !== 'number' || exp < Date.now()) return null;
    if (bindTo !== expectedBindTo) return null;
    return challenge as string;
  } catch {
    return null;
  }
}

// ── Short-lived WebAuthn token (returned after successful auth) ───────────────

export function createWebAuthnToken(cpf: string): string {
  const payload = JSON.stringify({ cpf, exp: Date.now() + 120_000 });
  const b64 = Buffer.from(payload).toString('base64url');
  return `${b64}.${hmacSign(b64)}`;
}

export function verifyWebAuthnToken(token: string): { cpf: string } | null {
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!hmacVerify(b64, sig)) return null;
  try {
    const { cpf, exp } = JSON.parse(Buffer.from(b64, 'base64url').toString());
    if (typeof exp !== 'number' || exp < Date.now()) return null;
    return { cpf };
  } catch {
    return null;
  }
}
