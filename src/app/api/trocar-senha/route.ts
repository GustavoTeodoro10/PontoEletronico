import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateFuncionarioSenha } from '@/lib/google-sheets';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { novaSenha } = await req.json();
  if (!novaSenha || typeof novaSenha !== 'string' || novaSenha.length < 6) {
    return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres.' }, { status: 400 });
  }

  const hash = await bcrypt.hash(novaSenha, 12);
  await updateFuncionarioSenha(session.user.cpf, hash);

  return NextResponse.json({ success: true });
}
