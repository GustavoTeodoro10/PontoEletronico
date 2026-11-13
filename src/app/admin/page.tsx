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

  const { role, unidadeId: gestorUnidadeId } = session.user;
  if (role !== 'admin' && role !== 'gestor') redirect('/dashboard');

  const isGestor = role === 'gestor';
  const hoje = new Date().toISOString().slice(0, 10);

  const [allRegistrosHoje, allJustificativas, allAtestados, allFuncionarios, unidades, assinaturasPendentes] =
    await Promise.all([
      getAllRegistrosByDate(hoje),
      getAllJustificativas(),
      getAllAtestados(),
      getAllFuncionarios(),
      getAllUnidades(),
      role === 'admin' ? getAllAssinaturasPendentes() : Promise.resolve([]),
    ]);

  // For gestores: filter everything to their unit
  const cpfsUnidade = isGestor
    ? new Set(allFuncionarios.filter(f => f.unidadeId === gestorUnidadeId).map(f => f.cpf))
    : null;

  const registrosHoje = isGestor
    ? allRegistrosHoje.filter(r => r.unidadeId === gestorUnidadeId)
    : allRegistrosHoje;

  const funcionarios = isGestor
    ? allFuncionarios.filter(f => f.unidadeId === gestorUnidadeId)
    : allFuncionarios;

  const justificativas = isGestor
    ? allJustificativas.filter(j => cpfsUnidade!.has(j.cpf))
    : allJustificativas;

  const atestados = isGestor
    ? allAtestados.filter(a => cpfsUnidade!.has(a.cpf))
    : allAtestados;

  return (
    <AdminClient
      role={role}
      gestorUnidadeId={isGestor ? gestorUnidadeId : undefined}
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
