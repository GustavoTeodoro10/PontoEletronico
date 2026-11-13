import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { getDispositivosByCPF, updateDispositivoCounter, getFuncionarioByCPF } from '@/lib/google-sheets';
import { verifyChallengeCookie, createWebAuthnToken, getRpConfig } from '@/lib/webauthn-token';
import { cleanCPF, validateCPF } from '@/lib/cpf';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const cpf = cleanCPF(String(body.cpf ?? ''));
  if (!validateCPF(cpf)) return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 });

  const { rpId, origin } = getRpConfig();

  const cookieStore = await cookies();
  const wa = cookieStore.get('wa_auth_challenge');
  if (!wa) return NextResponse.json({ error: 'Desafio não encontrado.' }, { status: 400 });

  const expectedChallenge = verifyChallengeCookie(wa.value, cpf);
  if (!expectedChallenge) return NextResponse.json({ error: 'Desafio inválido ou expirado.' }, { status: 400 });

  cookieStore.delete('wa_auth_challenge');

  const dispositivos = await getDispositivosByCPF(cpf);
  const dispositivo = dispositivos.find(d => d.ativo && d.credentialId === body.id);
  if (!dispositivo) return NextResponse.json({ error: 'Credential não reconhecida.' }, { status: 400 });

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      authenticator: {
        credentialID: isoBase64URL.toBuffer(dispositivo.credentialId),
        credentialPublicKey: isoBase64URL.toBuffer(dispositivo.publicKey),
        counter: dispositivo.counter,
        transports: dispositivo.transports
          ? (dispositivo.transports.split(',').filter(Boolean) as AuthenticatorTransportFuture[])
          : undefined,
      },
      requireUserVerification: true,
    });
  } catch {
    return NextResponse.json({ error: 'Verificação falhou.' }, { status: 400 });
  }

  if (!verification.verified) return NextResponse.json({ error: 'Verificação falhou.' }, { status: 400 });

  await updateDispositivoCounter(dispositivo.id, verification.authenticationInfo.newCounter);

  const func = await getFuncionarioByCPF(cpf);
  if (!func || !func.ativo) return NextResponse.json({ error: 'Usuário inativo.' }, { status: 403 });

  const token = createWebAuthnToken(cpf);
  return NextResponse.json({ ok: true, cpf, token });
}
