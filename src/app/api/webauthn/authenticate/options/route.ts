import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { getDispositivosByCPF } from '@/lib/google-sheets';
import { signChallenge, getRpConfig } from '@/lib/webauthn-token';
import { cleanCPF, validateCPF } from '@/lib/cpf';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';

export async function POST(req: NextRequest) {
  const { cpf: cpfRaw } = await req.json();
  const cpf = cleanCPF(String(cpfRaw ?? ''));
  if (!validateCPF(cpf)) return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 });

  const { rpId } = getRpConfig();

  const dispositivos = await getDispositivosByCPF(cpf);
  const ativos = dispositivos.filter(d => d.ativo);

  if (ativos.length === 0) {
    return NextResponse.json({ error: 'Nenhuma biometria cadastrada.' }, { status: 404 });
  }

  const allowCredentials = ativos.map(d => ({
    id: isoBase64URL.toBuffer(d.credentialId),
    type: 'public-key' as const,
    transports: d.transports
      ? (d.transports.split(',').filter(Boolean) as AuthenticatorTransportFuture[])
      : undefined,
  }));

  const options = await generateAuthenticationOptions({
    rpID: rpId,
    allowCredentials,
    userVerification: 'preferred',
  });

  const cookieStore = await cookies();
  cookieStore.set('wa_auth_challenge', signChallenge(options.challenge, cpf), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 300,
    path: '/',
  });

  return NextResponse.json(options);
}
