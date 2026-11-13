import { google } from 'googleapis';
import bcrypt from 'bcryptjs';
import type { Funcionario, Unidade, Registro, Justificativa, Atestado, PunchType, Cobertura, AssinaturaEspelho, Dispositivo } from '@/types';

// ── Auth ───────────────────────────────────────────────────────────────────
function getAuthClient() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
      private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

function getSheetsClient() {
  return google.sheets({ version: 'v4', auth: getAuthClient() });
}

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

// ── Tab names ──────────────────────────────────────────────────────────────
const TABS = {
  funcionarios:  'Funcionarios',
  unidades:      'Unidades',
  registros:     'Registros',
  justificativas:'Justificativas',
  atestados:     'Atestados',
  dispositivos:  'Dispositivos',
  coberturas:    'Coberturas',
  assinaturas:   'AssinaturaEspelho',
} as const;

// ── Generic helpers ────────────────────────────────────────────────────────
async function getRows(tab: string): Promise<string[][]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tab}!A2:Z`,
  });
  return (res.data.values as string[][]) || [];
}

async function appendRow(tab: string, values: (string | number | boolean | null)[]): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${tab}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [values.map(v => v === null ? '' : String(v))] },
  });
}

async function updateRow(tab: string, rowIndex: number, values: (string | number | boolean | null)[]): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${tab}!A${rowIndex + 2}`,
    valueInputOption: 'RAW',
    requestBody: { values: [values.map(v => v === null ? '' : String(v))] },
  });
}

// ── Funcionarios ───────────────────────────────────────────────────────────
// Columns: CPF | Matricula | Nome | PrimeiroNome | Sobrenome | UnidadeId | Cargo | SenhaHash | MustChangePassword | Ativo | DataCadastro | Role

function rowToFuncionario(r: string[]): Funcionario {
  return {
    cpf:               r[0]  || '',
    matricula:         r[1]  || '',
    nome:              r[2]  || '',
    primeiroNome:      r[3]  || '',
    sobrenome:         r[4]  || '',
    unidadeId:         r[5]  || '',
    cargo:             r[6]  || '',
    senhaHash:         r[7]  || '',
    mustChangePassword:r[8]  === 'TRUE',
    ativo:             r[9]  !== 'FALSE',
    dataCadastro:      r[10] || '',
    role:              (r[11] as Funcionario['role']) || 'funcionario',
  };
}

export async function getFuncionarioByCPF(cpf: string): Promise<Funcionario | null> {
  const rows = await getRows(TABS.funcionarios);
  const row = rows.find(r => r[0]?.replace(/\D/g, '') === cpf.replace(/\D/g, ''));
  return row ? rowToFuncionario(row) : null;
}

export async function getAllFuncionarios(): Promise<Funcionario[]> {
  const rows = await getRows(TABS.funcionarios);
  return rows.filter(r => r[0]).map(rowToFuncionario);
}

export async function createFuncionario(data: {
  cpf: string;
  nome: string;
  cargo: string;
  unidadeId: string;
  role: 'funcionario' | 'gestor';
}): Promise<{ matricula: string; senhaTemporaria: string }> {
  const rows = await getRows(TABS.funcionarios);
  if (rows.some(r => r[0]?.replace(/\D/g, '') === data.cpf.replace(/\D/g, ''))) {
    throw new Error('CPF já cadastrado.');
  }

  const count = rows.filter(r => r[0]).length;
  const matricula = String(count + 1).padStart(4, '0');

  const partes = data.nome.trim().split(/\s+/);
  const primeiroNome = partes[0] || '';
  const sobrenome = partes.slice(1).join(' ') || '';

  const senhaTemporaria = data.cpf.replace(/\D/g, '').slice(-6);
  const senhaHash = await bcrypt.hash(senhaTemporaria, 12);

  await appendRow(TABS.funcionarios, [
    data.cpf,
    matricula,
    data.nome.trim(),
    primeiroNome,
    sobrenome,
    data.unidadeId,
    data.cargo,
    senhaHash,
    'TRUE',
    'TRUE',
    new Date().toISOString(),
    data.role,
  ]);

  return { matricula, senhaTemporaria };
}

export async function updateFuncionarioSenha(cpf: string, novaHash: string): Promise<void> {
  const rows = await getRows(TABS.funcionarios);
  const idx = rows.findIndex(r => r[0]?.replace(/\D/g, '') === cpf.replace(/\D/g, ''));
  if (idx === -1) throw new Error('Funcionário não encontrado');
  const row = [...rows[idx]];
  row[7] = novaHash;
  row[8] = 'FALSE'; // mustChangePassword = false
  await updateRow(TABS.funcionarios, idx, row);
}

// ── Unidades ───────────────────────────────────────────────────────────────
// Columns: ID | Nome | Empresa | Endereco | Lat | Lon | RaioMetros | Ativo

function rowToUnidade(r: string[]): Unidade {
  return {
    id:          r[0] || '',
    nome:        r[1] || '',
    empresa:     r[2] || '',
    endereco:    r[3] || '',
    lat:         parseFloat(r[4]) || 0,
    lon:         parseFloat(r[5]) || 0,
    raioMetros:  parseInt(r[6]) || 200,
    ativo:       r[7] !== 'FALSE',
  };
}

export async function getAllUnidades(): Promise<Unidade[]> {
  const rows = await getRows(TABS.unidades);
  return rows.filter(r => r[0]).map(rowToUnidade);
}

export async function getUnidadeById(id: string): Promise<Unidade | null> {
  const rows = await getRows(TABS.unidades);
  const row = rows.find(r => r[0] === id);
  return row ? rowToUnidade(row) : null;
}

export async function appendUnidade(data: Omit<Unidade, 'id'>): Promise<string> {
  const id = `u${Date.now()}`;
  await appendRow(TABS.unidades, [id, data.nome, data.empresa, data.endereco, data.lat, data.lon, data.raioMetros, data.ativo ? 'TRUE' : 'FALSE']);
  return id;
}

export async function updateUnidade(id: string, data: Partial<Omit<Unidade, 'id'>>): Promise<void> {
  const rows = await getRows(TABS.unidades);
  const idx = rows.findIndex(r => r[0] === id);
  if (idx === -1) throw new Error('Unidade não encontrada.');
  const current = rowToUnidade(rows[idx]);
  const updated: Unidade = { ...current, ...data };
  await updateRow(TABS.unidades, idx, [updated.id, updated.nome, updated.empresa, updated.endereco, updated.lat, updated.lon, updated.raioMetros, updated.ativo ? 'TRUE' : 'FALSE']);
}

// ── Distance helper (Haversine) ────────────────────────────────────────────
export function calcDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Registros ──────────────────────────────────────────────────────────────
// Columns: ID | CPF | Matricula | Nome | UnidadeId | UnidadeNome | DataHora | Tipo | Lat | Lon | DentroDoRaio | DeviceId

function rowToRegistro(r: string[]): Registro {
  return {
    id:           r[0] || '',
    cpf:          r[1] || '',
    matricula:    r[2] || '',
    nome:         r[3] || '',
    unidadeId:    r[4] || '',
    unidadeNome:  r[5] || '',
    dataHora:     r[6] || '',
    tipo:         (r[7] as PunchType) || 'Entrada',
    lat:          r[8] ? parseFloat(r[8]) : null,
    lon:          r[9] ? parseFloat(r[9]) : null,
    dentroDoRaio: r[10] === 'TRUE' ? true : r[10] === 'FALSE' ? false : null,
    deviceId:     r[11] || '',
  };
}

export async function getRegistrosByCPF(cpf: string, limit = 50): Promise<Registro[]> {
  const rows = await getRows(TABS.registros);
  return rows
    .filter(r => r[1]?.replace(/\D/g, '') === cpf.replace(/\D/g, ''))
    .map(rowToRegistro)
    .reverse()
    .slice(0, limit);
}

export async function getRegistrosByMonth(cpf: string, year: number, month: number): Promise<Registro[]> {
  const rows = await getRows(TABS.registros);
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return rows
    .filter(r => r[1]?.replace(/\D/g, '') === cpf.replace(/\D/g, '') && r[6]?.startsWith(prefix))
    .map(rowToRegistro);
}

export async function getUltimoRegistro(cpf: string): Promise<Registro | null> {
  const registros = await getRegistrosByCPF(cpf, 1);
  return registros[0] || null;
}

export function proximoPunchType(ultimoRegistro: Registro | null): PunchType {
  if (!ultimoRegistro || ultimoRegistro.tipo === 'Saída') return 'Entrada';
  return 'Saída';
}

export async function appendRegistro(reg: Omit<Registro, 'id'>): Promise<Registro> {
  const id = `REG-${Date.now()}`;
  await appendRow(TABS.registros, [
    id,
    reg.cpf,
    reg.matricula,
    reg.nome,
    reg.unidadeId,
    reg.unidadeNome,
    reg.dataHora,
    reg.tipo,
    reg.lat ?? '',
    reg.lon ?? '',
    reg.dentroDoRaio === null ? '' : reg.dentroDoRaio ? 'TRUE' : 'FALSE',
    reg.deviceId,
  ]);
  return { ...reg, id };
}

// ── All registros (admin) ──────────────────────────────────────────────────
export async function getAllRegistrosByDate(datePrefix: string): Promise<Registro[]> {
  const rows = await getRows(TABS.registros);
  return rows
    .filter(r => r[6]?.startsWith(datePrefix))
    .map(rowToRegistro)
    .reverse();
}

// ── Reset senha de funcionário (admin only) ────────────────────────────────
export async function resetFuncionarioSenha(cpf: string): Promise<string> {
  const rows = await getRows(TABS.funcionarios);
  const idx = rows.findIndex(r => r[0]?.replace(/\D/g, '') === cpf.replace(/\D/g, ''));
  if (idx === -1) throw new Error('Funcionário não encontrado');
  const tempSenha = cpf.replace(/\D/g, '').slice(-6);
  const hash = await bcrypt.hash(tempSenha, 12);
  const row = [...rows[idx]];
  row[7] = hash;
  row[8] = 'TRUE'; // mustChangePassword
  await updateRow(TABS.funcionarios, idx, row);
  return tempSenha;
}

// ── Justificativas ─────────────────────────────────────────────────────────
export async function appendJustificativa(j: Omit<Justificativa, 'id'>): Promise<void> {
  const id = `JUS-${Date.now()}`;
  await appendRow(TABS.justificativas, [
    id, j.cpf, j.nome, j.data, j.tipo, j.descricao,
    j.status, j.gestorResposta, j.createdAt,
  ]);
}

function rowToJustificativa(r: string[]): Justificativa {
  return {
    id: r[0], cpf: r[1], nome: r[2], data: r[3], tipo: r[4],
    descricao: r[5], status: (r[6] || 'Pendente') as Justificativa['status'],
    gestorResposta: r[7] || '', createdAt: r[8] || '',
  };
}

export async function getJustificativasPendentes(): Promise<Justificativa[]> {
  const rows = await getRows(TABS.justificativas);
  return rows.filter(r => r[0] && r[6] === 'Pendente').map(rowToJustificativa);
}

export async function getAllJustificativas(): Promise<Justificativa[]> {
  const rows = await getRows(TABS.justificativas);
  return rows.filter(r => r[0]).map(rowToJustificativa)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getJustificativasByMonth(cpf: string, ano: number, mes: number): Promise<Justificativa[]> {
  const rows = await getRows(TABS.justificativas);
  const prefix = `${ano}-${String(mes).padStart(2, '0')}`;
  return rows
    .filter(r => r[0] && r[1]?.replace(/\D/g, '') === cpf.replace(/\D/g, '') && r[3]?.startsWith(prefix))
    .map(rowToJustificativa);
}

export async function updateJustificativaStatus(
  id: string,
  status: 'Aprovada' | 'Recusada',
  gestorResposta: string,
): Promise<void> {
  const rows = await getRows(TABS.justificativas);
  const idx = rows.findIndex(r => r[0] === id);
  if (idx === -1) throw new Error('Justificativa não encontrada');
  const row = [...rows[idx]];
  row[6] = status;
  row[7] = gestorResposta;
  await updateRow(TABS.justificativas, idx, row);
}

// ── Atestados ──────────────────────────────────────────────────────────────
// Columns: ID | CPF | NomeOriginal | NomeArquivo | GoogleDriveId | DataEnvio | DataAtestado | Status

function rowToAtestado(r: string[]): Atestado {
  return {
    id: r[0], cpf: r[1], nomeOriginal: r[2], nomeArquivo: r[3],
    googleDriveId: r[4], dataEnvio: r[5], dataAtestado: r[6],
    status: (r[7] || 'Pendente') as Atestado['status'],
  };
}

export async function appendAtestado(a: Omit<Atestado, 'id'>): Promise<string> {
  const id = `ATE-${Date.now()}`;
  await appendRow(TABS.atestados, [
    id, a.cpf, a.nomeOriginal, a.nomeArquivo, a.googleDriveId,
    a.dataEnvio, a.dataAtestado, a.status,
  ]);
  return id;
}

export async function getAllAtestados(): Promise<Atestado[]> {
  const rows = await getRows(TABS.atestados);
  return rows.filter(r => r[0]).map(rowToAtestado)
    .sort((a, b) => b.dataEnvio.localeCompare(a.dataEnvio));
}

export async function getAtestadosByCPF(cpf: string): Promise<Atestado[]> {
  const rows = await getRows(TABS.atestados);
  const clean = cpf.replace(/\D/g, '');
  return rows
    .filter(r => r[0] && r[1]?.replace(/\D/g, '') === clean)
    .map(rowToAtestado)
    .sort((a, b) => b.dataEnvio.localeCompare(a.dataEnvio));
}

export async function updateAtestadoStatus(id: string, status: 'Aprovado' | 'Recusado'): Promise<void> {
  const rows = await getRows(TABS.atestados);
  const idx = rows.findIndex(r => r[0] === id);
  if (idx === -1) throw new Error('Atestado não encontrado');
  const row = [...rows[idx]];
  row[7] = status;
  await updateRow(TABS.atestados, idx, row);
}

// ── Coberturas ─────────────────────────────────────────────────────────────
// Columns: ID | CPF | NomeFuncionario | UnidadeOrigemId | UnidadeCoberturaId | UnidadeCoberturaNome | DataInicio | DataFim | AdminCPF | CreatedAt | Ativo

function rowToCobertura(r: string[]): Cobertura {
  return {
    id:                  r[0] || '',
    cpf:                 r[1] || '',
    nomeFuncionario:     r[2] || '',
    unidadeOrigemId:     r[3] || '',
    unidadeCoberturaId:  r[4] || '',
    unidadeCoberturaNome:r[5] || '',
    dataInicio:          r[6] || '',
    dataFim:             r[7] || '',
    adminCpf:            r[8] || '',
    createdAt:           r[9] || '',
    ativo:               r[10] !== 'FALSE',
  };
}

export async function appendCobertura(c: Omit<Cobertura, 'id'>): Promise<void> {
  const id = `COB-${Date.now()}`;
  await appendRow(TABS.coberturas, [
    id, c.cpf, c.nomeFuncionario, c.unidadeOrigemId, c.unidadeCoberturaId,
    c.unidadeCoberturaNome, c.dataInicio, c.dataFim, c.adminCpf, c.createdAt, 'TRUE',
  ]);
}

export async function getCoberturas(cpf?: string): Promise<Cobertura[]> {
  let rows: string[][];
  try { rows = await getRows(TABS.coberturas); }
  catch { return []; }
  const all = rows.filter(r => r[0]).map(rowToCobertura);
  return cpf ? all.filter(c => c.cpf.replace(/\D/g,'') === cpf.replace(/\D/g,'')) : all;
}

export async function getCoberturaAtiva(cpf: string, date: string): Promise<Cobertura | null> {
  const coberturas = await getCoberturas(cpf);
  return coberturas.find(c =>
    c.ativo && c.dataInicio <= date && c.dataFim >= date
  ) || null;
}

export async function desativarCobertura(id: string): Promise<void> {
  const rows = await getRows(TABS.coberturas);
  const idx = rows.findIndex(r => r[0] === id);
  if (idx === -1) return;
  const row = [...rows[idx]];
  row[10] = 'FALSE';
  await updateRow(TABS.coberturas, idx, row);
}

// ── AssinaturaEspelho ──────────────────────────────────────────────────────
// Columns: ID | CPF | NomeFuncionario | Ano | Mes | StatusFuncionario | AssinadoFuncionarioEm | StatusAdmin | AssinadoAdminEm | AdminCPF

function rowToAssinatura(r: string[]): AssinaturaEspelho {
  return {
    id:                    r[0] || '',
    cpf:                   r[1] || '',
    nomeFuncionario:       r[2] || '',
    ano:                   parseInt(r[3]) || 0,
    mes:                   parseInt(r[4]) || 0,
    statusFuncionario:     (r[5] || 'Pendente') as AssinaturaEspelho['statusFuncionario'],
    assinadoFuncionarioEm: r[6] || '',
    statusAdmin:           (r[7] || 'Pendente') as AssinaturaEspelho['statusAdmin'],
    assinadoAdminEm:       r[8] || '',
    adminCpf:              r[9] || '',
  };
}

export async function getAssinaturaEspelho(cpf: string, ano: number, mes: number): Promise<AssinaturaEspelho | null> {
  let rows: string[][];
  try { rows = await getRows(TABS.assinaturas); }
  catch { return null; }
  const row = rows.find(r =>
    r[1]?.replace(/\D/g,'') === cpf.replace(/\D/g,'') &&
    r[3] === String(ano) && r[4] === String(mes)
  );
  return row ? rowToAssinatura(row) : null;
}

export async function assinarEspelhoFuncionario(cpf: string, nome: string, ano: number, mes: number): Promise<void> {
  let rows: string[][];
  try { rows = await getRows(TABS.assinaturas); }
  catch { rows = []; }
  const idx = rows.findIndex(r =>
    r[1]?.replace(/\D/g,'') === cpf.replace(/\D/g,'') &&
    r[3] === String(ano) && r[4] === String(mes)
  );
  const agora = new Date().toISOString();
  if (idx === -1) {
    const id = `ASS-${Date.now()}`;
    await appendRow(TABS.assinaturas, [id, cpf, nome, ano, mes, 'Confirmado', agora, 'Pendente', '', '']);
  } else {
    const row = [...rows[idx]];
    row[5] = 'Confirmado';
    row[6] = agora;
    await updateRow(TABS.assinaturas, idx, row);
  }
}

export async function assinarEspelhoAdmin(cpf: string, ano: number, mes: number, adminCpf: string): Promise<void> {
  let rows: string[][];
  try { rows = await getRows(TABS.assinaturas); }
  catch { return; }
  const idx = rows.findIndex(r =>
    r[1]?.replace(/\D/g,'') === cpf.replace(/\D/g,'') &&
    r[3] === String(ano) && r[4] === String(mes)
  );
  if (idx === -1) return;
  const agora = new Date().toISOString();
  const row = [...rows[idx]];
  row[7] = 'Assinado';
  row[8] = agora;
  row[9] = adminCpf;
  await updateRow(TABS.assinaturas, idx, row);
}

export async function getAllAssinaturasPendentes(): Promise<AssinaturaEspelho[]> {
  let rows: string[][];
  try { rows = await getRows(TABS.assinaturas); }
  catch { return []; }
  return rows
    .filter(r => r[0] && r[5] === 'Confirmado' && r[7] !== 'Assinado')
    .map(rowToAssinatura);
}

// ── Dispositivos ───────────────────────────────────────────────────────────
// Columns: ID | CPF | CredentialID | PublicKey | Counter | Transports | NomeDispositivo | CadastradoEm | Ativo

function rowToDispositivo(r: string[]): Dispositivo {
  return {
    id:              r[0] || '',
    cpf:             r[1] || '',
    credentialId:    r[2] || '',
    publicKey:       r[3] || '',
    counter:         parseInt(r[4]) || 0,
    transports:      r[5] || '',
    nomeDispositivo: r[6] || '',
    cadastradoEm:    r[7] || '',
    ativo:           r[8] !== 'FALSE',
  };
}

export async function getDispositivosByCPF(cpf: string): Promise<Dispositivo[]> {
  let rows: string[][];
  try { rows = await getRows(TABS.dispositivos); }
  catch { return []; }
  const clean = cpf.replace(/\D/g, '');
  return rows.filter(r => r[0] && r[1]?.replace(/\D/g, '') === clean).map(rowToDispositivo);
}

export async function appendDispositivo(data: Omit<Dispositivo, 'id'>): Promise<string> {
  const id = `d${Date.now()}`;
  await appendRow(TABS.dispositivos, [
    id, data.cpf, data.credentialId, data.publicKey,
    data.counter, data.transports, data.nomeDispositivo,
    data.cadastradoEm, data.ativo ? 'TRUE' : 'FALSE',
  ]);
  return id;
}

export async function updateDispositivoCounter(id: string, counter: number): Promise<void> {
  let rows: string[][];
  try { rows = await getRows(TABS.dispositivos); }
  catch { return; }
  const idx = rows.findIndex(r => r[0] === id);
  if (idx === -1) return;
  const row = [...rows[idx]];
  row[4] = String(counter);
  await updateRow(TABS.dispositivos, idx, row);
}

export async function deactivateDispositivo(id: string, cpf: string): Promise<void> {
  const rows = await getRows(TABS.dispositivos);
  const clean = cpf.replace(/\D/g, '');
  const idx = rows.findIndex(r => r[0] === id && r[1]?.replace(/\D/g, '') === clean);
  if (idx === -1) throw new Error('Dispositivo não encontrado.');
  const row = [...rows[idx]];
  row[8] = 'FALSE';
  await updateRow(TABS.dispositivos, idx, row);
}
