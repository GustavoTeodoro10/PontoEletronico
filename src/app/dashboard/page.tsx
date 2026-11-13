import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getUnidadeById, getUltimoRegistro, proximoPunchType, getRegistrosByCPF } from '@/lib/google-sheets';
import DashboardClient from './DashboardClient';

export const instant = false;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  if (session.user.mustChangePassword) redirect('/trocar-senha');

  const { cpf, matricula, nome, primeiroNome, unidadeId, role } = session.user;

  const [unidade, ultimoRegistro, registrosHoje] = await Promise.all([
    getUnidadeById(unidadeId),
    getUltimoRegistro(cpf),
    getRegistrosByCPF(cpf, 10),
  ]);

  const hoje = new Date().toISOString().slice(0, 10);
  const registrosDeHoje = registrosHoje.filter(r => r.dataHora.startsWith(hoje));

  const proximoTipo = proximoPunchType(ultimoRegistro);

  return (
    <DashboardClient
      funcionario={{ cpf, matricula, nome, primeiroNome, unidadeId, role }}
      unidade={unidade ?? null}
      proximoTipo={proximoTipo}
      ultimoRegistro={ultimoRegistro}
      registrosHoje={registrosDeHoje}
    />
  );
}
