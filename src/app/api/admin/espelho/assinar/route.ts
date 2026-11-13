import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assinarEspelhoAdmin, getAllAssinaturasPendentes } from '@/lib/google-sheets';
import { cleanCPF } from '@/lib/cpf';

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores.' }, { status: 403 });
  }
  const pendentes = await getAllAssinaturasPendentes();
  return NextResponse.json({ pendentes });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores.' }, { status: 403 });
  }

  const { cpf, ano, mes } = await req.json();
  if (!cpf || !ano || !mes) {
    return NextResponse.json({ error: 'CPF, ano e mês são obrigatórios.' }, { status: 400 });
  }

  await assinarEspelhoAdmin(cleanCPF(String(cpf)), Number(ano), Number(mes), session.user.cpf);
  return NextResponse.json({ success: true });
}
