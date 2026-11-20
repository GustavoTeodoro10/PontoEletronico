import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  updateJustificativaStatus,
  getJustificativaById,
  getFuncionarioByCPF,
  getUnidadeById,
  appendRegistro,
} from '@/lib/google-sheets';
import type { PunchType } from '@/types';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  if (session.user.role !== 'admin' && session.user.role !== 'gestor') {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
  }

  const { id } = await params;
  const { status, gestorResposta } = await req.json();

  if (status !== 'Aprovada' && status !== 'Recusada') {
    return NextResponse.json({ error: 'Status inválido.' }, { status: 400 });
  }

  await updateJustificativaStatus(id, status, gestorResposta ?? '');

  // Ao aprovar um ponto esquecido, inserir o registro automaticamente
  if (status === 'Aprovada') {
    const just = await getJustificativaById(id);
    if (just?.tipo === 'Ponto esquecido' && just.pontoTipo && just.pontoHorario) {
      const funcionario = await getFuncionarioByCPF(just.cpf);
      if (funcionario) {
        const unidade = await getUnidadeById(funcionario.unidadeId);
        await appendRegistro({
          cpf: just.cpf,
          matricula: funcionario.matricula,
          nome: funcionario.nome,
          unidadeId: funcionario.unidadeId,
          unidadeNome: unidade?.nome ?? '',
          dataHora: `${just.data}T${just.pontoHorario}:00`,
          tipo: just.pontoTipo as PunchType,
          lat: null,
          lon: null,
          dentroDoRaio: null,
          deviceId: 'manual',
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
