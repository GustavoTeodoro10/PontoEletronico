import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createFuncionario } from '@/lib/google-sheets';
import { cleanCPF, validateCPF } from '@/lib/cpf';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !['admin', 'gestor'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
  }

  const { nome, cpf, cargo, unidadeId, role } = await req.json();

  if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório.' }, { status: 400 });

  const cpfLimpo = cleanCPF(String(cpf || ''));
  if (!validateCPF(cpfLimpo)) return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 });

  if (!cargo?.trim()) return NextResponse.json({ error: 'Cargo obrigatório.' }, { status: 400 });
  if (!unidadeId) return NextResponse.json({ error: 'Selecione uma unidade.' }, { status: 400 });
  if (!['funcionario', 'gestor'].includes(role)) {
    return NextResponse.json({ error: 'Perfil inválido.' }, { status: 400 });
  }

  try {
    const result = await createFuncionario({
      cpf: cpfLimpo,
      nome: nome.trim(),
      cargo: cargo.trim(),
      unidadeId,
      role,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao cadastrar.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
