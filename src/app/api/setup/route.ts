import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { updateFuncionarioSenha } from '@/lib/google-sheets';

// One-time setup endpoint to seed a bcrypt password into the sheet.
// Requires SETUP_SECRET env var; delete this file after first use.
export async function POST(req: NextRequest) {
  const secret = process.env.SETUP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'SETUP_SECRET não configurado' }, { status: 403 });
  }

  const { setupKey, cpf, senha } = await req.json();

  if (setupKey !== secret) {
    return NextResponse.json({ error: 'Chave inválida' }, { status: 403 });
  }
  if (!cpf || !senha || senha.length < 6) {
    return NextResponse.json({ error: 'CPF e senha (mín 6 chars) obrigatórios' }, { status: 400 });
  }

  const hash = await bcrypt.hash(senha, 12);
  await updateFuncionarioSenha(cpf, hash);

  return NextResponse.json({ ok: true, message: 'Senha atualizada com sucesso' });
}
