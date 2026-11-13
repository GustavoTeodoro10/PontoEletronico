import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDispositivosByCPF } from '@/lib/google-sheets';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const dispositivos = await getDispositivosByCPF(session.user.cpf);
  const ativos = dispositivos
    .filter(d => d.ativo)
    .map(d => ({
      id: d.id,
      nomeDispositivo: d.nomeDispositivo,
      cadastradoEm: d.cadastradoEm,
    }));

  return NextResponse.json({ dispositivos: ativos });
}
