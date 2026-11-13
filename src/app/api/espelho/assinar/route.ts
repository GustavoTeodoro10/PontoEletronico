import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assinarEspelhoFuncionario, getRegistrosByMonth } from '@/lib/google-sheets';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const { ano, mes } = await req.json();
  if (!ano || !mes) {
    return NextResponse.json({ error: 'Ano e mês são obrigatórios.' }, { status: 400 });
  }

  // Verify there are actual registros to sign
  const registros = await getRegistrosByMonth(session.user.cpf, Number(ano), Number(mes));
  if (registros.length === 0) {
    return NextResponse.json({ error: 'Não há registros neste mês para assinar.' }, { status: 400 });
  }

  await assinarEspelhoFuncionario(session.user.cpf, session.user.nome, Number(ano), Number(mes));
  return NextResponse.json({ success: true });
}
