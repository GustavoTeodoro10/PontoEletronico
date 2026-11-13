import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateJustificativaStatus } from '@/lib/google-sheets';

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

  return NextResponse.json({ ok: true });
}
