import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRegistrosRecentes } from '@/lib/google-sheets';
import type { Alerta, Registro } from '@/types';

export async function GET() {
  const session = await auth();
  if (!session?.user || !['admin', 'gestor'].includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const isGestor = session.user.role === 'gestor';
  const gestorUnidadeId = session.user.unidadeId;

  const registros = await getRegistrosRecentes(14);
  const hoje = new Date().toISOString().slice(0, 10);
  const alertas: Alerta[] = [];

  // 1. Fora do raio
  for (const r of registros) {
    if (r.dentroDoRaio === false) {
      if (isGestor && r.unidadeId !== gestorUnidadeId) continue;
      alertas.push({
        id: r.id,
        tipo: 'fora_do_raio',
        cpf: r.cpf,
        nome: r.nome,
        unidadeId: r.unidadeId,
        unidadeNome: r.unidadeNome,
        dataHora: r.dataHora,
      });
    }
  }

  // 2. Ponto incompleto — dias passados com número ímpar de batidas
  const byEmpregadoByDia: Record<string, Record<string, Registro[]>> = {};
  for (const r of registros) {
    if (isGestor && r.unidadeId !== gestorUnidadeId) continue;
    const dia = r.dataHora.slice(0, 10);
    if (dia >= hoje) continue;
    if (!byEmpregadoByDia[r.cpf]) byEmpregadoByDia[r.cpf] = {};
    if (!byEmpregadoByDia[r.cpf][dia]) byEmpregadoByDia[r.cpf][dia] = [];
    byEmpregadoByDia[r.cpf][dia].push(r);
  }

  for (const [cpf, dias] of Object.entries(byEmpregadoByDia)) {
    for (const [dia, regs] of Object.entries(dias)) {
      if (regs.length % 2 !== 0) {
        const reg = regs[0];
        alertas.push({
          id: `incomplete-${cpf}-${dia}`,
          tipo: 'ponto_incompleto',
          cpf,
          nome: reg.nome,
          unidadeId: reg.unidadeId,
          unidadeNome: reg.unidadeNome,
          dataHora: `${dia}T12:00:00.000Z`,
          detalhes: `${regs.length} ${regs.length === 1 ? 'registro' : 'registros'}`,
        });
      }
    }
  }

  alertas.sort((a, b) => b.dataHora.localeCompare(a.dataHora));

  return NextResponse.json({ alertas, total: alertas.length });
}
