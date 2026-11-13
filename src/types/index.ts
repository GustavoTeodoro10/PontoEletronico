export type PunchType = 'Entrada' | 'Saída' | 'Entrada Almoço' | 'Saída Almoço';

export interface Funcionario {
  cpf: string;
  matricula: string;
  nome: string;
  primeiroNome: string;
  sobrenome: string;
  unidadeId: string;
  cargo: string;
  senhaHash: string;
  mustChangePassword: boolean;
  ativo: boolean;
  dataCadastro: string;
  role: 'funcionario' | 'gestor' | 'admin';
}

export interface Unidade {
  id: string;
  nome: string;
  empresa: string;
  endereco: string;
  lat: number;
  lon: number;
  raioMetros: number;
  ativo: boolean;
}

export interface Registro {
  id: string;
  cpf: string;
  matricula: string;
  nome: string;
  unidadeId: string;
  unidadeNome: string;
  dataHora: string;
  tipo: PunchType;
  lat: number | null;
  lon: number | null;
  dentroDoRaio: boolean | null;
  deviceId: string;
}

export interface Justificativa {
  id: string;
  cpf: string;
  nome: string;
  data: string;
  tipo: string;
  descricao: string;
  status: 'Pendente' | 'Aprovada' | 'Recusada';
  gestorResposta: string;
  createdAt: string;
}

export interface Atestado {
  id: string;
  cpf: string;
  nomeOriginal: string;
  nomeArquivo: string;
  googleDriveId: string;
  dataEnvio: string;
  dataAtestado: string;
  status: 'Pendente' | 'Aprovado' | 'Recusado';
}

export interface PunchResult {
  success: boolean;
  registro?: Registro;
  error?: string;
}

export interface DashboardData {
  funcionario: Pick<Funcionario, 'cpf' | 'nome' | 'primeiroNome' | 'matricula' | 'unidadeId' | 'role'>;
  unidade: Unidade;
  proximoTipo: PunchType;
  ultimoRegistro: Registro | null;
  registrosHoje: Registro[];
}

export interface Cobertura {
  id: string;
  cpf: string;
  nomeFuncionario: string;
  unidadeOrigemId: string;
  unidadeCoberturaId: string;
  unidadeCoberturaNome: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
  adminCpf: string;
  createdAt: string;
  ativo: boolean;
}

export interface AssinaturaEspelho {
  id: string;
  cpf: string;
  nomeFuncionario: string;
  ano: number;
  mes: number;
  statusFuncionario: 'Pendente' | 'Confirmado';
  assinadoFuncionarioEm: string;
  statusAdmin: 'Pendente' | 'Assinado';
  assinadoAdminEm: string;
  adminCpf: string;
}

export interface Dispositivo {
  id: string;
  cpf: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string;
  nomeDispositivo: string;
  cadastradoEm: string;
  ativo: boolean;
}

export interface Alerta {
  id: string;
  tipo: 'fora_do_raio' | 'ponto_incompleto';
  cpf: string;
  nome: string;
  unidadeId: string;
  unidadeNome: string;
  dataHora: string;
  detalhes?: string;
}

export interface BancoHorasDia {
  data: string;         // YYYY-MM-DD
  horasTrabalhadas: number;
  horasEsperadas: number;
  saldo: number;        // positive = extra, negative = deficit
}

export interface BancoHorasMes {
  totalTrabalhado: number;
  totalEsperado: number;
  saldo: number;
  detalhesPorDia: BancoHorasDia[];
}
