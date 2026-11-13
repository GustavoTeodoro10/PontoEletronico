import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resetFuncionarioSenha } from '@/lib/google-sheets';
import { cleanCPF, validateCPF } from '@/lib/cpf';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem resetar senhas.' }, { status: 403 });
  }

  const { cpf } = await req.json();
  const cpfLimpo = cleanCPF(String(cpf || ''));
  if (!validateCPF(cpfLimpo)) {
    return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 });
  }
  if (cpfLimpo === session.user.cpf.replace(/\D/g, '')) {
    return NextResponse.json({ error: 'Use a tela de trocar senha para alterar sua própria senha.' }, { status: 400 });
  }

  await resetFuncionarioSenha(cpfLimpo);

  return NextResponse.json({ success: true });
}
