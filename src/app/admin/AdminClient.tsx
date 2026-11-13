'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Registro, Justificativa, Funcionario, Unidade, AssinaturaEspelho } from '@/types';

interface Props {
  role: string;
  registrosHoje: Registro[];
  justificativasPendentes: Justificativa[];
  assinaturasPendentes: AssinaturaEspelho[];
  funcionarios: Funcionario[];
  unidades: Unidade[];
  totalFuncionarios: number;
  hoje: string;
}

type Tab = 'hoje' | 'justificativas' | 'funcionarios' | 'assinaturas' | 'coberturas';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export default function AdminClient({
  role, registrosHoje, justificativasPendentes, assinaturasPendentes,
  funcionarios, unidades, totalFuncionarios, hoje,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('hoje');

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

  // Assinatura admin
  const [assinandoId, setAssinandoId] = useState('');

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
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Funcionários" value={totalFuncionarios} />
          <Kpi label="Presentes hoje" value={presentes} accent />
          <Kpi label="Fora do raio" value={foraRaio} warn={foraRaio > 0} />
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto bg-white rounded-xl shadow-sm">
          {(['hoje', 'justificativas', 'assinaturas', 'funcionarios', 'coberturas'] as Tab[]).map(t => (
            <TabBtn key={t} active={tab === t} onClick={() => setTab(t)}>
              {t === 'hoje' ? `Hoje (${registrosHoje.length})`
                : t === 'justificativas' ? `Justif. (${justificativasPendentes.length})`
                : t === 'assinaturas' ? `Assin. (${assinaturasPendentes.length})`
                : t === 'funcionarios' ? 'Funcionários'
                : 'Coberturas'}
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
            {justificativasPendentes.length === 0 ? (
              <p className="text-center text-eif-text text-sm p-6">Nenhuma justificativa pendente.</p>
            ) : (
              <div className="divide-y divide-eif-cream-mid">
                {justificativasPendentes.map(j => (
                  <div key={j.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-eif-dark">{j.nome}</p>
                        <p className="text-xs text-eif-text">{j.data} · {j.tipo}</p>
                        <p className="text-sm text-eif-text mt-1">{j.descricao}</p>
                      </div>
                      <span className="shrink-0 text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                        Pendente
                      </span>
                    </div>
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
    <div className={`rounded-xl shadow-sm p-3 text-center ${accent ? 'bg-eif-red text-white' : 'bg-white'}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${accent ? 'text-white/80' : 'text-eif-text'}`}>
        {label}
      </p>
      <p className={`font-bold text-2xl mt-0.5 ${warn ? 'text-amber-500' : accent ? 'text-white' : 'text-eif-dark'}`}>
        {value}
      </p>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-none px-3 py-3 text-xs font-medium whitespace-nowrap transition ${
        active ? 'bg-eif-red text-white' : 'text-eif-text hover:bg-eif-cream'
      }`}
    >
      {children}
    </button>
  );
}
