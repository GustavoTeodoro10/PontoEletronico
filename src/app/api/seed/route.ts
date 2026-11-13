import { NextRequest, NextResponse } from 'next/server';
import { createFuncionario } from '@/lib/google-sheets';
import { google } from 'googleapis';

// ROTA TEMPORÁRIA DE SEED — remover após popular os dados

const SEED_SECRET = process.env.SEED_SECRET ?? 'eif-seed-2026';

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
      private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function appendRows(tab: string, rows: (string | number | boolean | null)[][]): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: `${tab}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: rows.map(r => r.map(v => v === null ? '' : String(v))) },
  });
}

// Gera horários de batida realistas (em minutos após meia-noite)
function isoTs(date: string, h: number, m: number): string {
  return `${date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00.000Z`;
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Dias úteis de outubro e novembro 2026 (segunda a sexta, sem feriados nacionais)
const DIAS_OUTUBRO = [
  '2026-10-01','2026-10-02','2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09',
  '2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-19','2026-10-20',
  '2026-10-21','2026-10-22','2026-10-23','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30',
];
const DIAS_NOVEMBRO = [
  '2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06',
  '2026-11-09','2026-11-10','2026-11-12','2026-11-13',
];

interface Employee {
  cpf: string;
  nome: string;
  cargo: string;
  unidadeId: string;
  unidadeNome: string;
  matricula: string;
  lat: number;
  lon: number;
}

export async function POST(req: NextRequest) {
  const { secret } = await req.json().catch(() => ({ secret: '' }));
  if (secret !== SEED_SECRET) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const log: string[] = [];

  // ── 1. Criar funcionários ───────────────────────────────────────────────
  const novosFuncionarios = [
    { cpf: '523.456.789-10', nome: 'Ana Paula Santos',    cargo: 'Cozinheira',         unidadeId: 'unidade-001', role: 'funcionario' as const },
    { cpf: '234.567.891-23', nome: 'Carlos Mendes',       cargo: 'Auxiliar de Cozinha', unidadeId: 'unidade-001', role: 'funcionario' as const },
    { cpf: '345.678.912-34', nome: 'Maria Fernanda Costa',cargo: 'Caixa',              unidadeId: 'unidade-001', role: 'funcionario' as const },
    { cpf: '456.789.123-45', nome: 'Roberto Silva',       cargo: 'Atendente',          unidadeId: 'u1794583545651', role: 'funcionario' as const },
    { cpf: '567.891.234-56', nome: 'Juliana Oliveira',    cargo: 'Supervisora',        unidadeId: 'u1794583545651', role: 'gestor' as const },
    { cpf: '678.912.345-67', nome: 'Pedro Alves',         cargo: 'Auxiliar',           unidadeId: 'u1794583545651', role: 'funcionario' as const },
  ];

  const criados: { nome: string; cpf: string; matricula: string; senha: string }[] = [];
  for (const f of novosFuncionarios) {
    try {
      const r = await createFuncionario(f);
      criados.push({ nome: f.nome, cpf: f.cpf, matricula: r.matricula, senha: r.senhaTemporaria });
      log.push(`✅ Criado: ${f.nome} (mat. ${r.matricula}, senha: ${r.senhaTemporaria})`);
    } catch (e: unknown) {
      log.push(`⚠️ ${f.nome}: ${e instanceof Error ? e.message : 'erro'}`);
    }
  }

  // Mapeamento CPF → matrícula para usar nos registros
  const matMap: Record<string, string> = {
    '52345678910': criados.find(c => c.cpf === '523.456.789-10')?.matricula ?? '0003',
    '23456789123': criados.find(c => c.cpf === '234.567.891-23')?.matricula ?? '0004',
    '34567891234': criados.find(c => c.cpf === '345.678.912-34')?.matricula ?? '0005',
    '45678912345': criados.find(c => c.cpf === '456.789.123-45')?.matricula ?? '0006',
    '56789123456': criados.find(c => c.cpf === '567.891.234-56')?.matricula ?? '0007',
    '67891234567': criados.find(c => c.cpf === '678.912.345-67')?.matricula ?? '0008',
  };

  // ── 2. Popular registros de ponto ───────────────────────────────────────
  const employees: Employee[] = [
    // Sede EIF
    { cpf: '52345678910', nome: 'Ana Paula Santos',     cargo: 'Cozinheira',          unidadeId: 'unidade-001',      unidadeNome: 'Sede EIF',      matricula: matMap['52345678910'], lat: -23.5505, lon: -46.6333 },
    { cpf: '23456789123', nome: 'Carlos Mendes',        cargo: 'Auxiliar de Cozinha', unidadeId: 'unidade-001',      unidadeNome: 'Sede EIF',      matricula: matMap['23456789123'], lat: -23.5505, lon: -46.6333 },
    { cpf: '34567891234', nome: 'Maria Fernanda Costa', cargo: 'Caixa',               unidadeId: 'unidade-001',      unidadeNome: 'Sede EIF',      matricula: matMap['34567891234'], lat: -23.5505, lon: -46.6333 },
    { cpf: '11144477735', nome: 'Administrador EIF',    cargo: 'Administrador',       unidadeId: 'unidade-001',      unidadeNome: 'Sede EIF',      matricula: '1',                  lat: -23.5505, lon: -46.6333 },
    // Filial Centro
    { cpf: '45678912345', nome: 'Roberto Silva',        cargo: 'Atendente',           unidadeId: 'u1794583545651',   unidadeNome: 'Filial Centro', matricula: matMap['45678912345'], lat: -23.5489, lon: -46.6388 },
    { cpf: '56789123456', nome: 'Juliana Oliveira',     cargo: 'Supervisora',         unidadeId: 'u1794583545651',   unidadeNome: 'Filial Centro', matricula: matMap['56789123456'], lat: -23.5489, lon: -46.6388 },
    { cpf: '67891234567', nome: 'Pedro Alves',          cargo: 'Auxiliar',            unidadeId: 'u1794583545651',   unidadeNome: 'Filial Centro', matricula: matMap['67891234567'], lat: -23.5489, lon: -46.6388 },
  ];

  const registrosRows: (string | number | boolean | null)[][] = [];
  let regCount = 0;

  for (const emp of employees) {
    const todosDias = [...DIAS_OUTUBRO, ...DIAS_NOVEMBRO];
    for (let di = 0; di < todosDias.length; di++) {
      const dia = todosDias[di];
      // Ponto incompleto: último dia de outubro de cada 3º funcionário (3 batidas)
      const incompleto = di === DIAS_OUTUBRO.length - 1 && ['34567891234','67891234567'].includes(emp.cpf);
      // Fora do raio: dia 2 de novembro para Roberto Silva
      const foraRaio = dia === '2026-11-02' && emp.cpf === '45678912345';

      const tipos: string[] = incompleto
        ? ['Entrada', 'Saída', 'Entrada']
        : ['Entrada', 'Saída', 'Entrada', 'Saída'];

      const horarios: [number, number][] = incompleto
        ? [[8, rand(0, 10)], [12, rand(0, 5)], [13, rand(0, 10)]]
        : [[8, rand(0, 10)], [12, rand(0, 5)], [13, rand(0, 10)], [17, rand(0, 10)]];

      for (let i = 0; i < tipos.length; i++) {
        const [h, m] = horarios[i];
        const dataHora = isoTs(dia, h, m);
        const dentroDoRaio = foraRaio ? false : true;
        const latOffset = foraRaio ? 0.05 : 0.0001 * rand(-3, 3);
        const lonOffset = foraRaio ? 0.05 : 0.0001 * rand(-3, 3);
        const id = `REG-${Date.now()}-${regCount++}`;
        registrosRows.push([
          id,
          emp.cpf,
          emp.matricula,
          emp.nome,
          emp.unidadeId,
          emp.unidadeNome,
          dataHora,
          tipos[i],
          emp.lat + latOffset,
          emp.lon + lonOffset,
          dentroDoRaio ? 'TRUE' : 'FALSE',
          'seed-device',
        ]);
      }
    }
  }

  // Inserir em lotes de 200 (limite do Sheets API)
  const BATCH = 200;
  for (let i = 0; i < registrosRows.length; i += BATCH) {
    await appendRows('Registros', registrosRows.slice(i, i + BATCH));
  }
  log.push(`✅ ${registrosRows.length} registros de ponto inseridos`);

  // ── 3. Justificativas ───────────────────────────────────────────────────
  const now = new Date().toISOString();
  const justificativas: (string | number | boolean | null)[][] = [
    [`JUS-${Date.now()+1}`, '52345678910', 'Ana Paula Santos',    '2026-11-05', 'Atraso',              'Trânsito intenso na manhã',           'Pendente', '', now],
    [`JUS-${Date.now()+2}`, '23456789123', 'Carlos Mendes',       '2026-11-10', 'Saída antecipada',    'Consulta médica agendada',            'Pendente', '', now],
    [`JUS-${Date.now()+3}`, '45678912345', 'Roberto Silva',       '2026-11-03', 'Falta',               'Filho doente, sem substituto',        'Pendente', '', now],
    [`JUS-${Date.now()+4}`, '67891234567', 'Pedro Alves',         '2026-10-20', 'Atraso',              'Problema no transporte público',      'Aprovada', 'Ok, registrado.', '2026-10-21T09:00:00.000Z'],
    [`JUS-${Date.now()+5}`, '34567891234', 'Maria Fernanda Costa','2026-10-28', 'Saída antecipada',    'Manutenção em residência (urgência)', 'Recusada', 'Precisa de documentação.', '2026-10-29T10:00:00.000Z'],
  ];
  await appendRows('Justificativas', justificativas);
  log.push(`✅ ${justificativas.length} justificativas inseridas`);

  // ── 4. Atestados ────────────────────────────────────────────────────────
  const atestados: (string | number | boolean | null)[][] = [
    [`ATE-${Date.now()+1}`, '34567891234', 'atestado_maria_nov.pdf',  'atestado_maria_nov.pdf',  '', now, '2026-11-06', 'Pendente'],
    [`ATE-${Date.now()+2}`, '56789123456', 'atestado_juliana_out.pdf','atestado_juliana_out.pdf','', '2026-10-15T08:00:00.000Z', '2026-10-14', 'Aprovado'],
  ];
  await appendRows('Atestados', atestados);
  log.push(`✅ ${atestados.length} atestados inseridos`);

  return NextResponse.json({
    ok: true,
    log,
    credenciais: criados.map(c => ({ nome: c.nome, cpf: c.cpf, matricula: c.matricula, senhaTemp: c.senha })),
  });
}
