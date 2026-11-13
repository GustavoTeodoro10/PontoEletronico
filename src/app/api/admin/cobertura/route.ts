import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { appendCobertura, getCoberturas, desativarCobertura, getFuncionarioByCPF, getUnidadeById } from '@/lib/google-sheets';
import { cleanCPF, validateCPF } from '@/lib/cpf';

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores.' }, { status: 403 });
  }
  const coberturas = await getCoberturas();
  return NextResponse.json({ coberturas });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores.' }, { status: 403 });
  }

  const { cpf, unidadeCoberturaId, dataInicio, dataFim } = await req.json();
  const cpfLimpo = cleanCPF(String(cpf || ''));
  if (!validateCPF(cpfLimpo)) {
    return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 });
  }
  if (!dataInicio || !dataFim || dataFim < dataInicio) {
    return NextResponse.json({ error: 'Período inválido.' }, { status: 400 });
  }

  const [func, unidade] = await Promise.all([
    getFuncionarioByCPF(cpfLimpo),
    getUnidadeById(String(unidadeCoberturaId || '')),
  ]);
  if (!func) return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 });
  if (!unidade) return NextResponse.json({ error: 'Unidade não encontrada.' }, { status: 404 });

  await appendCobertura({
    cpf: cpfLimpo,
    nomeFuncionario: func.nome,
    unidadeOrigemId: func.unidadeId,
    unidadeCoberturaId,
    unidadeCoberturaNome: unidade.nome,
    dataInicio,
    dataFim,
    adminCpf: session.user.cpf,
    createdAt: new Date().toISOString(),
    ativo: true,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores.' }, { status: 403 });
  }
  const { id } = await req.json();
  await desativarCobertura(String(id || ''));
  return NextResponse.json({ success: true });
}
