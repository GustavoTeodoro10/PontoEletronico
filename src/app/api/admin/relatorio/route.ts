import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRegistrosByMonth, getAssinaturaEspelho, getFuncionarioByCPF } from '@/lib/google-sheets';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  if (session.user.role !== 'admin' && session.user.role !== 'gestor') {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const cpf = searchParams.get('cpf');
  const ano = parseInt(searchParams.get('ano') ?? '');
  const mes = parseInt(searchParams.get('mes') ?? '');

  if (!cpf || !ano || !mes) {
    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 });
  }

  try {
    const [registros, assinatura, funcionario] = await Promise.all([
      getRegistrosByMonth(cpf, ano, mes),
      getAssinaturaEspelho(cpf, ano, mes),
      getFuncionarioByCPF(cpf),
    ]);
    return NextResponse.json({ registros, assinatura, funcionario });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
