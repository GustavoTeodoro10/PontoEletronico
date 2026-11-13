import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateUnidade } from '@/lib/google-sheets';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  try {
    await updateUnidade(id, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
