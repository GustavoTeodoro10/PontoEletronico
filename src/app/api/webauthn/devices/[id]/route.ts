import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deactivateDispositivo } from '@/lib/google-sheets';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await params;

  try {
    await deactivateDispositivo(id, session.user.cpf);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
