import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { appendDispositivo } from '@/lib/google-sheets';
import { verifyChallengeCookie, getRpConfig } from '@/lib/webauthn-token';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const cpf = session.user.cpf;
  const { rpId, origin } = getRpConfig();

  const cookieStore = await cookies();
  const wa = cookieStore.get('wa_reg_challenge');
  if (!wa) return NextResponse.json({ error: 'Desafio não encontrado.' }, { status: 400 });

  const expectedChallenge = verifyChallengeCookie(wa.value, cpf);
  if (!expectedChallenge) return NextResponse.json({ error: 'Desafio inválido ou expirado.' }, { status: 400 });

  cookieStore.delete('wa_reg_challenge');

  const body = await req.json();

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      requireUserVerification: true,
    });
  } catch {
    return NextResponse.json({ error: 'Verificação falhou.' }, { status: 400 });
  }

  const { verified, registrationInfo } = verification;
  if (!verified || !registrationInfo) {
    return NextResponse.json({ error: 'Verificação falhou.' }, { status: 400 });
  }

  const { credentialID, credentialPublicKey, counter } = registrationInfo;
  const credentialIdB64 = isoBase64URL.fromBuffer(credentialID);
  const publicKeyB64 = isoBase64URL.fromBuffer(credentialPublicKey);

  const ua = req.headers.get('user-agent') ?? '';
  const nomeDispositivo = detectDeviceName(ua);
  const transports: string = Array.isArray(body.response?.transports)
    ? body.response.transports.join(',')
    : '';

  await appendDispositivo({
    cpf,
    credentialId: credentialIdB64,
    publicKey: publicKeyB64,
    counter,
    transports,
    nomeDispositivo,
    cadastradoEm: new Date().toISOString(),
    ativo: true,
  });

  return NextResponse.json({ ok: true, nomeDispositivo });
}

function detectDeviceName(ua: string): string {
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Macintosh/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows';
  return 'Dispositivo';
}
