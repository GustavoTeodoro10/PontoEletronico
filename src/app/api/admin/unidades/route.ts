import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { appendUnidade } from '@/lib/google-sheets';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });

  const body = await req.json();
  const { nome, empresa, endereco, lat, lon, raioMetros, horasDia, diasSemana } = body;

  if (!nome || !empresa || !endereco || lat === undefined || lon === undefined) {
    return NextResponse.json({ error: 'Campos obrigatórios: nome, empresa, endereço, lat, lon.' }, { status: 400 });
  }

  const dias = Array.isArray(diasSemana) ? diasSemana.map(Number).filter(n => n >= 0 && n <= 6) : [1,2,3,4,5];

  try {
    const id = await appendUnidade({
      nome: String(nome).trim(),
      empresa: String(empresa).trim(),
      endereco: String(endereco).trim(),
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      raioMetros: parseInt(raioMetros) || 1000,
      ativo: true,
      horasDia: parseFloat(horasDia) || 8,
      diasSemana: dias.length ? dias : [1,2,3,4,5],
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
