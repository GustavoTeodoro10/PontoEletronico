import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { appendJustificativa } from '@/lib/google-sheets';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { data, tipo, descricao } = await req.json();

  if (!data || !tipo || !descricao?.trim()) {
    return NextResponse.json({ error: 'Preencha todos os campos.' }, { status: 400 });
  }

  // Validate date format and that it belongs to a reasonable range
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ error: 'Data inválida.' }, { status: 400 });
  }

  await appendJustificativa({
    cpf: session.user.cpf,
    nome: session.user.nome,
    data,
    tipo,
    descricao: descricao.trim(),
    status: 'Pendente',
    gestorResposta: '',
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
