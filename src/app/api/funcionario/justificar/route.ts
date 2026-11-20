import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { appendJustificativa } from '@/lib/google-sheets';
import type { PunchType } from '@/types';

const PUNCH_TYPES: PunchType[] = ['Entrada', 'Saída Almoço', 'Entrada Almoço', 'Saída'];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { data, tipo, descricao, pontoTipo, pontoHorario } = await req.json();

  if (!data || !tipo || !descricao?.trim()) {
    return NextResponse.json({ error: 'Preencha todos os campos.' }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ error: 'Data inválida.' }, { status: 400 });
  }

  if (tipo === 'Ponto esquecido') {
    if (!pontoTipo || !PUNCH_TYPES.includes(pontoTipo)) {
      return NextResponse.json({ error: 'Tipo do ponto inválido.' }, { status: 400 });
    }
    if (!pontoHorario || !/^\d{2}:\d{2}$/.test(pontoHorario)) {
      return NextResponse.json({ error: 'Horário inválido (use HH:MM).' }, { status: 400 });
    }
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
    pontoTipo: tipo === 'Ponto esquecido' ? (pontoTipo as PunchType) : undefined,
    pontoHorario: tipo === 'Ponto esquecido' ? pontoHorario : undefined,
  });

  return NextResponse.json({ ok: true });
}
