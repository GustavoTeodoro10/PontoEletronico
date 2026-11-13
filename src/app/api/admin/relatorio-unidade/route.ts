import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAllFuncionarios, getAllUnidades, getAllRegistrosByMonth } from '@/lib/google-sheets';
import { calcularBancoHorasMes } from '@/lib/banco-horas';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !['admin', 'gestor'].includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unidadeId = searchParams.get('unidadeId') ?? '';
  const ano = parseInt(searchParams.get('ano') ?? '');
  const mes = parseInt(searchParams.get('mes') ?? '');

  if (!unidadeId || isNaN(ano) || isNaN(mes) || mes < 1 || mes > 12) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
  }

  if (session.user.role === 'gestor' && session.user.unidadeId !== unidadeId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  const [allFuncionarios, allUnidades, allRegistros] = await Promise.all([
    getAllFuncionarios(),
    getAllUnidades(),
    getAllRegistrosByMonth(ano, mes),
  ]);

  const unidade = allUnidades.find(u => u.id === unidadeId);
  if (!unidade) return NextResponse.json({ error: 'Unidade não encontrada' }, { status: 404 });

  const funcionariosUnidade = allFuncionarios.filter(f => f.unidadeId === unidadeId && f.ativo);

  const funcionarios = funcionariosUnidade.map(func => {
    const registros = allRegistros.filter(r => r.cpf === func.cpf);
    const banco = calcularBancoHorasMes(registros, ano, mes);
    return {
      funcionario: { cpf: func.cpf, nome: func.nome, matricula: func.matricula, cargo: func.cargo },
      banco,
    };
  });

  return NextResponse.json({
    unidade: { id: unidade.id, nome: unidade.nome },
    funcionarios,
  });
}
