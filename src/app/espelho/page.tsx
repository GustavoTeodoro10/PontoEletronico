import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getRegistrosByMonth, getAssinaturaEspelho, getJustificativasByMonth } from '@/lib/google-sheets';
import EspelhoClient from './EspelhoClient';

export const instant = false;

export default async function EspelhoPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const params = await searchParams;
  const hoje   = new Date();
  const ano    = parseInt(params.ano  || String(hoje.getFullYear()));
  const mes    = parseInt(params.mes  || String(hoje.getMonth() + 1));

  const [registros, assinatura, justificativas] = await Promise.all([
    getRegistrosByMonth(session.user.cpf, ano, mes),
    getAssinaturaEspelho(session.user.cpf, ano, mes),
    getJustificativasByMonth(session.user.cpf, ano, mes),
  ]);

  return (
    <EspelhoClient
      nome={session.user.primeiroNome}
      nomeCompleto={session.user.nome}
      cpf={session.user.cpf}
      cargo={session.user.cargo ?? ''}
      matricula={session.user.matricula}
      registros={registros}
      justificativas={justificativas}
      ano={ano}
      mes={mes}
      assinatura={assinatura}
    />
  );
}
