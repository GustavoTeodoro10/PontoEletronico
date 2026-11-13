import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { getDispositivosByCPF } from '@/lib/google-sheets';
import { signChallenge, getRpConfig } from '@/lib/webauthn-token';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const cpf = session.user.cpf;
  const nome = session.user.nome ?? session.user.primeiroNome ?? cpf;
  const { rpId } = getRpConfig();

  const existing = await getDispositivosByCPF(cpf);
  const excludeCredentials = existing
    .filter(d => d.ativo)
    .map(d => ({
      id: isoBase64URL.toBuffer(d.credentialId),
      type: 'public-key' as const,
      transports: d.transports
        ? (d.transports.split(',').filter(Boolean) as AuthenticatorTransportFuture[])
        : undefined,
    }));

  const options = await generateRegistrationOptions({
    rpName: 'EIF Ponto Eletrônico',
    rpID: rpId,
    userID: cpf,
    userName: cpf,
    userDisplayName: nome,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  const cookieStore = await cookies();
  cookieStore.set('wa_reg_challenge', signChallenge(options.challenge, cpf), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 300,
    path: '/',
  });

  return NextResponse.json(options);
}
