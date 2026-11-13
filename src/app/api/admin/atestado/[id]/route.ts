import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateAtestadoStatus } from '@/lib/google-sheets';

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
  const { status } = await req.json();

  if (status !== 'Aprovado' && status !== 'Recusado') {
    return NextResponse.json({ error: 'Status inválido.' }, { status: 400 });
  }

  await updateAtestadoStatus(id, status);
  return NextResponse.json({ ok: true });
}
