import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRegistrosByCPF, getRegistrosByMonth } from '@/lib/google-sheets';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const year  = searchParams.get('year');
  const month = searchParams.get('month');

  const { cpf } = session.user;

  if (year && month) {
    const registros = await getRegistrosByMonth(cpf, parseInt(year), parseInt(month));
    return NextResponse.json({ registros });
  }

  const limit    = parseInt(searchParams.get('limit') || '20');
  const registros = await getRegistrosByCPF(cpf, limit);
  return NextResponse.json({ registros });
}
