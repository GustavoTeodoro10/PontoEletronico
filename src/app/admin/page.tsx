import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  getAllRegistrosByDate,
  getAllJustificativas,
  getAllAtestados,
  getAllFuncionarios,
  getAllUnidades,
  getAllAssinaturasPendentes,
} from '@/lib/google-sheets';
import AdminClient from './AdminClient';

export const instant = false;

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { role } = session.user;
  if (role !== 'admin' && role !== 'gestor') redirect('/dashboard');

  const hoje = new Date().toISOString().slice(0, 10);

  const [registrosHoje, justificativas, atestados, funcionarios, unidades, assinaturasPendentes] =
    await Promise.all([
      getAllRegistrosByDate(hoje),
      getAllJustificativas(),
      getAllAtestados(),
      getAllFuncionarios(),
      getAllUnidades(),
      role === 'admin' ? getAllAssinaturasPendentes() : Promise.resolve([]),
    ]);

  return (
    <AdminClient
      role={role}
      registrosHoje={registrosHoje}
      justificativas={justificativas}
      atestados={atestados}
      assinaturasPendentes={assinaturasPendentes}
      funcionarios={funcionarios}
      unidades={unidades}
      totalFuncionarios={funcionarios.filter(f => f.ativo).length}
      hoje={hoje}
    />
  );
}
