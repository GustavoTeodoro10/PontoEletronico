'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Registro, Justificativa, Atestado, Funcionario, Unidade, AssinaturaEspelho } from '@/types';
import { formatCPF, cleanCPF } from '@/lib/cpf';
import { calcularBancoHorasMes, formatHoras } from '@/lib/banco-horas';

interface Props {
  role: string;
  registrosHoje: Registro[];
  justificativas: Justificativa[];
  atestados: Atestado[];
  assinaturasPendentes: AssinaturaEspelho[];
  funcionarios: Funcionario[];
  unidades: Unidade[];
  totalFuncionarios: number;
  hoje: string;
}

type Tab = 'hoje' | 'justificativas' | 'atestados' | 'assinaturas' | 'relatorio' | 'funcionarios' | 'coberturas' | 'cadastrar';

interface RelatorioData {
  registros: Registro[];
  assinatura: AssinaturaEspelho | null;
  funcionario: Funcionario | null;
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export default function AdminClient({
  role, registrosHoje, justificativas: initialJustificativas, atestados: initialAtestados,
  assinaturasPendentes, funcionarios, unidades, totalFuncionarios, hoje,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('hoje');

  // Justificativas
  const [justificativas, setJustificativas] = useState<Justificativa[]>(initialJustificativas);
  const [justRespostas, setJustRespostas] = useState<Record<string, string>>({});
  const [justLoading, setJustLoading] = useState('');

  // Atestados
  const [atestados, setAtestados] = useState<Atestado[]>(initialAtestados);
  const [ateLoading, setAteLoading] = useState('');

  // Relatório
  const [relCpf,     setRelCpf]     = useState('');
  const [relAno,     setRelAno]     = useState(() => new Date().getFullYear());
  const [relMes,     setRelMes]     = useState(() => new Date().getMonth() + 1);
  const [relData,    setRelData]    = useState<RelatorioData | null>(null);
  const [relLoading, setRelLoading] = useState(false);
  const [relErr,     setRelErr]     = useState('');

  async function handleBuscarRelatorio() {
    if (!relCpf) return;
    setRelLoading(true);
    setRelErr('');
    setRelData(null);
    try {
      const res = await fetch(`/api/admin/relatorio?cpf=${encodeURIComponent(relCpf)}&ano=${relAno}&mes=${relMes}`);
      const json = await res.json();
      if (!res.ok) { setRelErr(json.error || 'Erro ao buscar.'); return; }
      setRelData(json);
    } finally {
      setRelLoading(false);
    }
  }

  async function handleDownloadPDF() {
    if (!relData) return;
    const unidadeNome = unidades.find(u => u.id === relData.funcionario?.unidadeId)?.nome ?? '—';
    const { generatePontoPDF } = await import('@/lib/generate-pdf');
    await generatePontoPDF({
      nome: relData.funcionario?.nome ?? relCpf,
      cpf: relCpf,
      matricula: relData.funcionario?.matricula ?? '—',
      cargo: relData.funcionario?.cargo ?? '—',
      unidadeNome,
      registros: relData.registros,
      assinatura: relData.assinatura,
      ano: relAno,
      mes: relMes,
    });
  }

  // Reset senha
  const [resettingCpf, setResettingCpf] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  // Nova cobertura
  const [cobCpf, setCobCpf] = useState('');
  const [cobUnidade, setCobUnidade] = useState('');
  const [cobInicio, setCobInicio] = useState('');
  const [cobFim, setCobFim] = useState('');
  const [cobLoading, setCobLoading] = useState(false);
  const [cobMsg, setCobMsg] = useState('');

  async function handleJustificativa(id: string, status: 'Aprovada' | 'Recusada') {
    setJustLoading(id);
    try {
      const res = await fetch(`/api/admin/justificativa/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, gestorResposta: justRespostas[id] ?? '' }),
      });
      if (!res.ok) return;
      setJustificativas(prev => prev.map(j => j.id === id ? { ...j, status, gestorResposta: justRespostas[id] ?? '' } : j));
    } finally {
      setJustLoading('');
    }
  }

  async function handleAtestado(id: string, status: 'Aprovado' | 'Recusado') {
    setAteLoading(id);
    try {
      const res = await fetch(`/api/admin/atestado/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) return;
      setAtestados(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } finally {
      setAteLoading('');
    }
  }

  // Assinatura admin
  const [assinandoId, setAssinandoId] = useState('');

  // Cadastro de funcionário
  const [cadNome,     setCadNome]     = useState('');
  const [cadCpf,      setCadCpf]      = useState('');
  const [cadCargo,    setCadCargo]    = useState('');
  const [cadUnidade,  setCadUnidade]  = useState('');
  const [cadRole,     setCadRole]     = useState<'funcionario' | 'gestor'>('funcionario');
  const [cadLoading,  setCadLoading]  = useState(false);
  const [cadErr,      setCadErr]      = useState('');
  const [cadResult,   setCadResult]   = useState<{ matricula: string; senhaTemporaria: string } | null>(null);

  function handleCadCpfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = cleanCPF(e.target.value);
    if (digits.length <= 11) setCadCpf(formatCPF(digits));
  }

  async function handleCadastrar(e: React.FormEvent) {
    e.preventDefault();
    setCadLoading(true);
    setCadErr('');
    setCadResult(null);
    const res = await fetch('/api/admin/cadastrar-funcionario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: cadNome, cpf: cadCpf, cargo: cadCargo, unidadeId: cadUnidade, role: cadRole }),
    });
    const data = await res.json();
    setCadLoading(false);
    if (!res.ok) { setCadErr(data.error || 'Erro ao cadastrar.'); return; }
    setCadResult(data);
    setCadNome(''); setCadCpf(''); setCadCargo(''); setCadUnidade(''); setCadRole('funcionario');
    router.refresh();
  }

  const presentes = new Set(registrosHoje.map(r => r.cpf)).size;
  const foraRaio  = registrosHoje.filter(r => r.dentroDoRaio === false).length;

  async function handleResetSenha(cpf: string, nome: string) {
    if (!confirm(`Resetar a senha de ${nome}? A senha temporária será os 6 últimos dígitos do CPF.`)) return;
    setResettingCpf(cpf);
    setResetMsg('');
    const res = await fetch('/api/admin/reset-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf }),
    });
    const data = await res.json();
    setResettingCpf('');
    if (res.ok) {
      setResetMsg(`Senha de ${nome} resetada. Senha temporária: últimos 6 dígitos do CPF.`);
    } else {
      setResetMsg(`Erro: ${data.error}`);
    }
  }

  async function handleNovaCobertura(e: React.FormEvent) {
    e.preventDefault();
    setCobLoading(true);
    setCobMsg('');
    const res = await fetch('/api/admin/cobertura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: cobCpf, unidadeCoberturaId: cobUnidade, dataInicio: cobInicio, dataFim: cobFim }),
    });
    const data = await res.json();
    setCobLoading(false);
    if (res.ok) {
      setCobMsg('Cobertura criada com sucesso!');
      setCobCpf(''); setCobUnidade(''); setCobInicio(''); setCobFim('');
    } else {
      setCobMsg(`Erro: ${data.error}`);
    }
  }

  async function handleAssinarEspelho(ass: AssinaturaEspelho) {
    setAssinandoId(ass.id);
    const res = await fetch('/api/admin/espelho/assinar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: ass.cpf, ano: ass.ano, mes: ass.mes }),
    });
    setAssinandoId('');
    if (res.ok) router.refresh();
  }

  return (
    <main className="min-h-dvh flex flex-col bg-eif-cream pb-safe">
      {/* Header */}
      <header className="bg-eif-red text-white px-4 pt-safe pb-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => router.push('/dashboard')} className="text-white/80 hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <h1 className="font-semibold text-lg">Painel {role === 'admin' ? 'Admin' : 'Gestor'}</h1>
          </div>
          <p className="text-sm opacity-80">
            {new Date(hoje + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </header>

      <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full flex flex-col gap-6">
        {/* KPIs */}
        <div className="bg-white rounded-2xl shadow-sm flex divide-x divide-eif-cream-mid overflow-hidden">
          <Kpi label="Funcionários" value={totalFuncionarios} />
          <Kpi label="Presentes hoje" value={presentes} accent />
          <Kpi label="Fora do raio" value={foraRaio} warn={foraRaio > 0} />
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto bg-white rounded-xl shadow-sm border-b border-eif-cream-mid">
          {(['hoje', 'justificativas', 'atestados', 'assinaturas', 'relatorio', 'funcionarios', 'coberturas', 'cadastrar'] as Tab[]).map(t => (
            <TabBtn key={t} active={tab === t} onClick={() => setTab(t)}>
              {t === 'hoje'          ? `Hoje (${registrosHoje.length})`
                : t === 'justificativas' ? `Justif. (${justificativas.filter(j => j.status === 'Pendente').length})`
                : t === 'atestados'      ? `Atestos (${atestados.filter(a => a.status === 'Pendente').length})`
                : t === 'assinaturas'    ? `Assin. (${assinaturasPendentes.length})`
                : t === 'relatorio'      ? 'Relatório'
                : t === 'funcionarios'   ? 'Funcionários'
                : t === 'coberturas'     ? 'Coberturas'
                : '+ Cadastrar'}
            </TabBtn>
          ))}
        </div>

        {/* Tab: Hoje */}
        {tab === 'hoje' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {registrosHoje.length === 0 ? (
              <p className="text-center text-eif-text text-sm p-6">Nenhum registro hoje.</p>
            ) : (
              <div className="divide-y divide-eif-cream-mid">
                {registrosHoje.map(r => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-eif-dark truncate">{r.nome}</p>
                      <p className="text-xs text-eif-text">{r.unidadeNome}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.dentroDoRaio === false && (
                        <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">Fora</span>
                      )}
                      <span className="text-xs font-medium text-eif-red">{r.tipo}</span>
                      <span className="text-xs text-eif-text tabular-nums">
                        {new Date(r.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Justificativas */}
        {tab === 'justificativas' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {justificativas.length === 0 ? (
              <p className="text-center text-eif-text text-sm p-6">Nenhuma justificativa registrada.</p>
            ) : (
              <div className="divide-y divide-eif-cream-mid">
                {justificativas.map(j => (
                  <div key={j.id} className="px-4 py-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-eif-dark">{j.nome}</p>
                        <p className="text-xs text-eif-text">
                          {new Date(j.data + 'T12:00:00').toLocaleDateString('pt-BR')} · {j.tipo}
                        </p>
                        <p className="text-sm text-eif-text mt-1">{j.descricao}</p>
                        {j.gestorResposta && (
                          <p className="text-xs text-eif-text italic mt-1">Resposta: {j.gestorResposta}</p>
                        )}
                      </div>
                      <span className={`shrink-0 text-xs rounded-full px-2 py-0.5 font-medium ${
                        j.status === 'Aprovada' ? 'bg-green-100 text-green-700' :
                        j.status === 'Recusada' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {j.status}
                      </span>
                    </div>
                    {j.status === 'Pendente' && (
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="Resposta do gestor (opcional)"
                          value={justRespostas[j.id] ?? ''}
                          onChange={e => setJustRespostas(prev => ({ ...prev, [j.id]: e.target.value }))}
                          className="w-full border border-eif-cream-mid rounded-lg px-3 py-2 text-xs text-eif-dark bg-white focus:outline-none focus:ring-2 focus:ring-eif-red/30"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleJustificativa(j.id, 'Aprovada')}
                            disabled={justLoading === j.id}
                            className="flex-1 bg-green-600 text-white rounded-lg py-2 text-xs font-semibold disabled:opacity-60"
                          >
                            {justLoading === j.id ? '…' : 'Aprovar'}
                          </button>
                          <button
                            onClick={() => handleJustificativa(j.id, 'Recusada')}
                            disabled={justLoading === j.id}
                            className="flex-1 bg-red-600 text-white rounded-lg py-2 text-xs font-semibold disabled:opacity-60"
                          >
                            {justLoading === j.id ? '…' : 'Recusar'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Atestados */}
        {tab === 'atestados' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {atestados.length === 0 ? (
              <p className="text-center text-eif-text text-sm p-6">Nenhum atestado enviado.</p>
            ) : (
              <div className="divide-y divide-eif-cream-mid">
                {atestados.map(a => (
                  <div key={a.id} className="px-4 py-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-eif-dark truncate">{a.nomeOriginal}</p>
                        <p className="text-xs text-eif-text">
                          CPF: {a.cpf} · Data: {new Date(a.dataAtestado + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </p>
                        <p className="text-xs text-eif-text">
                          Enviado: {new Date(a.dataEnvio).toLocaleDateString('pt-BR')}
                        </p>
                        {a.googleDriveId && (
                          <a
                            href={`https://drive.google.com/file/d/${a.googleDriveId}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-eif-red font-medium mt-1 inline-flex items-center gap-1"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                              <polyline points="15 3 21 3 21 9"/>
                              <line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                            Ver arquivo
                          </a>
                        )}
                      </div>
                      <span className={`shrink-0 text-xs rounded-full px-2 py-0.5 font-medium ${
                        a.status === 'Aprovado' ? 'bg-green-100 text-green-700' :
                        a.status === 'Recusado' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {a.status}
                      </span>
                    </div>
                    {a.status === 'Pendente' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAtestado(a.id, 'Aprovado')}
                          disabled={ateLoading === a.id}
                          className="flex-1 bg-green-600 text-white rounded-lg py-2 text-xs font-semibold disabled:opacity-60"
                        >
                          {ateLoading === a.id ? '…' : 'Aprovar'}
                        </button>
                        <button
                          onClick={() => handleAtestado(a.id, 'Recusado')}
                          disabled={ateLoading === a.id}
                          className="flex-1 bg-red-600 text-white rounded-lg py-2 text-xs font-semibold disabled:opacity-60"
                        >
                          {ateLoading === a.id ? '…' : 'Recusar'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Assinaturas pendentes */}
        {tab === 'assinaturas' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {assinaturasPendentes.length === 0 ? (
              <p className="text-center text-eif-text text-sm p-6">Nenhum espelho aguardando assinatura.</p>
            ) : (
              <div className="divide-y divide-eif-cream-mid">
                {assinaturasPendentes.map(ass => (
                  <div key={ass.id} className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-eif-dark truncate">{ass.nomeFuncionario}</p>
                      <p className="text-xs text-eif-text">
                        {MESES[ass.mes - 1]} {ass.ano} · confirmado em{' '}
                        {ass.assinadoFuncionarioEm
                          ? new Date(ass.assinadoFuncionarioEm).toLocaleDateString('pt-BR')
                          : '—'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAssinarEspelho(ass)}
                      disabled={assinandoId === ass.id}
                      className="shrink-0 text-xs bg-eif-red text-white rounded-lg px-3 py-2 font-medium disabled:opacity-60"
                    >
                      {assinandoId === ass.id ? '…' : 'Assinar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Funcionários */}
        {tab === 'funcionarios' && (
          <div className="flex flex-col gap-4">
            {resetMsg && (
              <div className={`rounded-xl px-4 py-3 text-sm ${resetMsg.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {resetMsg}
              </div>
            )}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {funcionarios.filter(f => f.ativo).map(f => (
                <div key={f.cpf} className="flex items-center justify-between px-4 py-3 gap-4 border-b border-eif-cream-mid last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-eif-dark truncate">{f.nome}</p>
                    <p className="text-xs text-eif-text">{f.cargo} · {f.role}</p>
                  </div>
                  <button
                    onClick={() => handleResetSenha(f.cpf, f.nome)}
                    disabled={resettingCpf === f.cpf}
                    className="shrink-0 text-xs bg-amber-500 text-white rounded-lg px-3 py-2 font-medium disabled:opacity-60"
                  >
                    {resettingCpf === f.cpf ? '…' : 'Reset Senha'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Cadastrar */}
        {tab === 'cadastrar' && (
          <div className="flex flex-col gap-4">
            {cadResult && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4">
                <p className="text-sm font-semibold text-green-700 mb-2">Funcionário cadastrado!</p>
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-green-700">Matrícula: <strong>{cadResult.matricula}</strong></p>
                  <p className="text-xs text-green-700">
                    Senha temporária:{' '}
                    <strong className="font-mono tracking-wider">{cadResult.senhaTemporaria}</strong>
                    <span className="text-green-500 ml-1">(últimos 6 dígitos do CPF)</span>
                  </p>
                  <p className="text-xs text-green-500 mt-1">O funcionário deve trocar a senha no primeiro acesso.</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-sm font-semibold text-eif-dark mb-4">Novo Funcionário</p>
              <form onSubmit={handleCadastrar} className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Nome completo"
                  value={cadNome}
                  onChange={e => setCadNome(e.target.value)}
                  required
                  className="border border-eif-cream-dark rounded-xl px-3 py-2.5 text-sm text-eif-dark focus:outline-none focus:ring-2 focus:ring-eif-red/40"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="CPF (000.000.000-00)"
                  value={cadCpf}
                  onChange={handleCadCpfChange}
                  required
                  className="border border-eif-cream-dark rounded-xl px-3 py-2.5 text-sm text-eif-dark focus:outline-none focus:ring-2 focus:ring-eif-red/40"
                />
                <input
                  type="text"
                  placeholder="Cargo (ex: Cozinheiro, Auxiliar)"
                  value={cadCargo}
                  onChange={e => setCadCargo(e.target.value)}
                  required
                  className="border border-eif-cream-dark rounded-xl px-3 py-2.5 text-sm text-eif-dark focus:outline-none focus:ring-2 focus:ring-eif-red/40"
                />
                <select
                  value={cadUnidade}
                  onChange={e => setCadUnidade(e.target.value)}
                  required
                  className="border border-eif-cream-dark rounded-xl px-3 py-2.5 text-sm text-eif-dark focus:outline-none focus:ring-2 focus:ring-eif-red/40"
                >
                  <option value="">Unidade de trabalho…</option>
                  {unidades.map(u => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
                <select
                  value={cadRole}
                  onChange={e => setCadRole(e.target.value as 'funcionario' | 'gestor')}
                  className="border border-eif-cream-dark rounded-xl px-3 py-2.5 text-sm text-eif-dark focus:outline-none focus:ring-2 focus:ring-eif-red/40"
                >
                  <option value="funcionario">Funcionário</option>
                  <option value="gestor">Gestor</option>
                </select>

                {cadErr && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{cadErr}</p>
                )}

                <button
                  type="submit"
                  disabled={cadLoading}
                  className="bg-eif-red text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {cadLoading ? (
                    <>
                      <svg className="animate-spin w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      Cadastrando…
                    </>
                  ) : 'Cadastrar Funcionário'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab: Relatório */}
        {tab === 'relatorio' && (
          <div className="flex flex-col gap-4">
            {/* Filtros */}
            <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-eif-dark">Relatório de Horas</p>
              <select
                value={relCpf}
                onChange={e => { setRelCpf(e.target.value); setRelData(null); }}
                className="border border-eif-cream-dark rounded-xl px-3 py-2.5 text-sm text-eif-dark focus:outline-none focus:ring-2 focus:ring-eif-red/40"
              >
                <option value="">Selecionar funcionário…</option>
                {funcionarios.filter(f => f.ativo).map(f => (
                  <option key={f.cpf} value={f.cpf}>{f.nome}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <select
                  value={relMes}
                  onChange={e => { setRelMes(Number(e.target.value)); setRelData(null); }}
                  className="flex-1 border border-eif-cream-dark rounded-xl px-3 py-2.5 text-sm text-eif-dark focus:outline-none focus:ring-2 focus:ring-eif-red/40"
                >
                  {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select
                  value={relAno}
                  onChange={e => { setRelAno(Number(e.target.value)); setRelData(null); }}
                  className="flex-1 border border-eif-cream-dark rounded-xl px-3 py-2.5 text-sm text-eif-dark focus:outline-none focus:ring-2 focus:ring-eif-red/40"
                >
                  {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <button
                onClick={handleBuscarRelatorio}
                disabled={!relCpf || relLoading}
                className="bg-eif-red text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {relLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Buscando…
                  </>
                ) : 'Buscar'}
              </button>
              {relErr && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{relErr}</p>}
            </div>

            {/* Resultado */}
            {relData && (() => {
              const banco = calcularBancoHorasMes(relData.registros, relAno, relMes);
              const byDay: Record<string, Registro[]> = {};
              for (const r of relData.registros) {
                const day = r.dataHora.slice(0, 10);
                (byDay[day] ??= []).push(r);
              }
              const days = Object.keys(byDay).sort();
              const bancoByDay: Record<string, number> = {};
              for (const d of banco.detalhesPorDia) bancoByDay[d.data] = d.horasTrabalhadas;

              const fmtTime = (recs: Registro[], tipo: string) => {
                const r = recs.find(x => x.tipo === tipo);
                return r ? new Date(r.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
              };

              return (
                <>
                  {/* Cabeçalho do funcionário */}
                  <div className="bg-white rounded-2xl shadow-sm px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-eif-dark">{relData.funcionario?.nome ?? relCpf}</p>
                        <p className="text-xs text-eif-text">
                          {relData.funcionario?.cargo ?? '—'} · {unidades.find(u => u.id === relData.funcionario?.unidadeId)?.nome ?? ''} · {MESES[relMes - 1]} {relAno}
                        </p>
                      </div>
                      <button
                        onClick={handleDownloadPDF}
                        className="shrink-0 flex items-center gap-1.5 bg-eif-red text-white rounded-lg px-3 py-2 text-xs font-semibold"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        PDF
                      </button>
                    </div>
                  </div>

                  {/* KPIs do mês */}
                  <div className="bg-white rounded-2xl shadow-sm flex divide-x divide-eif-cream-mid overflow-hidden">
                    <div className="flex-1 px-3 py-4 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-eif-text">Dias</p>
                      <p className="font-bold text-2xl mt-1 tabular-nums text-eif-dark">{days.length}</p>
                    </div>
                    <div className="flex-1 px-3 py-4 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-eif-text">Trabalhado</p>
                      <p className="font-bold text-2xl mt-1 tabular-nums text-eif-dark">{formatHoras(banco.totalTrabalhado)}</p>
                    </div>
                    <div className="flex-1 px-3 py-4 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-eif-text">Esperado</p>
                      <p className="font-bold text-2xl mt-1 tabular-nums text-eif-dark">{formatHoras(banco.totalEsperado)}</p>
                    </div>
                    <div className={`flex-1 px-3 py-4 text-center ${banco.saldo >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-eif-text">Saldo</p>
                      <p className={`font-bold text-2xl mt-1 tabular-nums ${banco.saldo >= 0 ? 'text-green-700' : 'text-eif-red'}`}>
                        {banco.saldo >= 0 ? '+' : ''}{formatHoras(banco.saldo)}
                      </p>
                    </div>
                  </div>

                  {/* Tabela de registros */}
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    {days.length === 0 ? (
                      <p className="text-center text-eif-text text-sm p-6">Nenhum registro neste período.</p>
                    ) : (
                      <>
                        {/* Cabeçalho da tabela */}
                        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-0 bg-eif-red text-white text-[10px] font-semibold uppercase tracking-wide px-4 py-2">
                          <span>Data</span>
                          <span className="w-10 text-center">Entr.</span>
                          <span className="w-10 text-center">S.Alm</span>
                          <span className="w-10 text-center">E.Alm</span>
                          <span className="w-10 text-center">Saída</span>
                          <span className="w-10 text-center">Total</span>
                        </div>
                        <div className="divide-y divide-eif-cream-mid">
                          {days.map((day, idx) => {
                            const recs = byDay[day];
                            const horas = bancoByDay[day] ?? 0;
                            const dateObj = new Date(day + 'T12:00:00');
                            const dateStr = dateObj.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
                            const isSat = dateObj.getDay() === 6;
                            const isSun = dateObj.getDay() === 0;
                            return (
                              <div
                                key={day}
                                className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-0 px-4 py-2.5 text-xs tabular-nums ${
                                  isSun ? 'bg-red-50/50' : isSat ? 'bg-amber-50/40' : idx % 2 === 1 ? 'bg-eif-cream/40' : ''
                                }`}
                              >
                                <span className="text-eif-dark font-medium capitalize">{dateStr}</span>
                                <span className="w-10 text-center text-eif-text">{fmtTime(recs, 'Entrada')}</span>
                                <span className="w-10 text-center text-eif-text">{fmtTime(recs, 'Saída Almoço')}</span>
                                <span className="w-10 text-center text-eif-text">{fmtTime(recs, 'Entrada Almoço')}</span>
                                <span className="w-10 text-center text-eif-text">{fmtTime(recs, 'Saída')}</span>
                                <span className={`w-10 text-center font-semibold ${horas > 0 ? 'text-eif-dark' : 'text-eif-text/50'}`}>
                                  {horas > 0 ? formatHoras(horas) : '—'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Tab: Coberturas */}
        {tab === 'coberturas' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-sm font-semibold text-eif-dark mb-3">Nova Cobertura</p>
              <form onSubmit={handleNovaCobertura} className="flex flex-col gap-3">
                <select
                  value={cobCpf}
                  onChange={e => setCobCpf(e.target.value)}
                  required
                  className="border border-eif-cream-dark rounded-xl px-3 py-2.5 text-sm text-eif-dark focus:outline-none focus:ring-2 focus:ring-eif-red/40"
                >
                  <option value="">Selecionar funcionário…</option>
                  {funcionarios.filter(f => f.ativo).map(f => (
                    <option key={f.cpf} value={f.cpf}>{f.nome}</option>
                  ))}
                </select>
                <select
                  value={cobUnidade}
                  onChange={e => setCobUnidade(e.target.value)}
                  required
                  className="border border-eif-cream-dark rounded-xl px-3 py-2.5 text-sm text-eif-dark focus:outline-none focus:ring-2 focus:ring-eif-red/40"
                >
                  <option value="">Unidade de cobertura…</option>
                  {unidades.map(u => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input type="date" value={cobInicio} onChange={e => setCobInicio(e.target.value)} required
                    className="flex-1 border border-eif-cream-dark rounded-xl px-3 py-2.5 text-sm text-eif-dark focus:outline-none focus:ring-2 focus:ring-eif-red/40" />
                  <input type="date" value={cobFim} onChange={e => setCobFim(e.target.value)} required
                    className="flex-1 border border-eif-cream-dark rounded-xl px-3 py-2.5 text-sm text-eif-dark focus:outline-none focus:ring-2 focus:ring-eif-red/40" />
                </div>
                <button
                  type="submit"
                  disabled={cobLoading}
                  className="bg-eif-red text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-60"
                >
                  {cobLoading ? 'Salvando…' : 'Criar Cobertura'}
                </button>
                {cobMsg && (
                  <p className={`text-xs ${cobMsg.startsWith('Erro') ? 'text-red-600' : 'text-green-600'}`}>{cobMsg}</p>
                )}
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Kpi({ label, value, accent, warn }: { label: string; value: number; accent?: boolean; warn?: boolean }) {
  return (
    <div className={`flex-1 px-4 py-4 text-center ${accent ? 'bg-eif-red' : ''}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-widest ${accent ? 'text-white/70' : 'text-eif-text'}`}>
        {label}
      </p>
      <p className={`font-bold text-3xl mt-1 tabular-nums ${warn ? 'text-eif-amber' : accent ? 'text-white' : 'text-eif-dark'}`}>
        {value}
      </p>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-none px-4 py-3 text-xs font-semibold whitespace-nowrap transition border-b-2 -mb-px ${
        active ? 'border-eif-red text-eif-red' : 'border-transparent text-eif-text hover:text-eif-dark'
      }`}
    >
      {children}
    </button>
  );
}
