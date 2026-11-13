import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getFuncionarioByCPF,
  getUnidadeById,
  getUltimoRegistro,
  proximoPunchType,
  calcDistanceMeters,
  appendRegistro,
  getCoberturaAtiva,
} from '@/lib/google-sheets';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  let body: { lat?: number; lon?: number; deviceId?: string; unidadeId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body inválido' }, { status: 400 }); }

  const { cpf, matricula, nome, unidadeId: sessaoUnidadeId } = session.user;
  const hoje = new Date().toISOString().slice(0, 10);

  // Check for active cobertura — use coverage unit if present
  const cobertura = await getCoberturaAtiva(cpf, hoje);
  const unidadeId = cobertura?.unidadeCoberturaId || body.unidadeId || sessaoUnidadeId;

  const [funcionario, unidade, ultimoRegistro] = await Promise.all([
    getFuncionarioByCPF(cpf),
    getUnidadeById(unidadeId),
    getUltimoRegistro(cpf),
  ]);

  if (!funcionario?.ativo) {
    return NextResponse.json({ error: 'Funcionário inativo' }, { status: 403 });
  }
  if (!unidade) {
    return NextResponse.json({ error: 'Unidade não encontrada' }, { status: 404 });
  }

  const tipo = proximoPunchType(ultimoRegistro);

  // GPS check (advisory only — does not block)
  let dentroDoRaio: boolean | null = null;
  if (body.lat != null && body.lon != null) {
    const distancia = calcDistanceMeters(body.lat, body.lon, unidade.lat, unidade.lon);
    dentroDoRaio = distancia <= unidade.raioMetros;
  }

  const agora = new Date();
  const dataHora = agora.toISOString();

  const registro = await appendRegistro({
    cpf,
    matricula,
    nome,
    unidadeId,
    unidadeNome: unidade.nome,
    dataHora,
    tipo,
    lat:          body.lat  ?? null,
    lon:          body.lon  ?? null,
    dentroDoRaio,
    deviceId:     body.deviceId || '',
  });

  return NextResponse.json({
    success: true,
    registro,
    dentroDoRaio,
    alertaRH: dentroDoRaio === false,
  });
}
