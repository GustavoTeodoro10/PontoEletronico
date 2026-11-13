'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Registro, AssinaturaEspelho, Justificativa, Atestado } from '@/types';
import { calcularBancoHorasMes, formatHoras } from '@/lib/banco-horas';

const TIPOS_JUSTIFICATIVA = [
  'Falta justificada',
  'Atestado médico',
  'Licença',
  'Folga compensatória',
  'Outros',
];

interface Props {
  nome: string;
  nomeCompleto: string;
  cpf: string;
  cargo: string;
  matricula: string;
  registros: Registro[];
  justificativas: Justificativa[];
  atestados: Atestado[];
  ano: number;
  mes: number;
  assinatura: AssinaturaEspelho | null;
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function EspelhoClient({ nome, nomeCompleto, cpf, cargo, matricula, registros, justificativas: initialJustificativas, atestados: initialAtestados, ano, mes, assinatura: initialAssinatura }: Props) {
  const router = useRouter();
  const [assinatura, setAssinatura] = useState(initialAssinatura);
  const [assinando, setAssinando] = useState(false);
  const [erroAssinatura, setErroAssinatura] = useState('');
  const [baixandoPDF, setBaixandoPDF] = useState(false);

  // Justificativas
  const [justificativas, setJustificativas] = useState<Justificativa[]>(initialJustificativas);
  const [justOpen, setJustOpen] = useState(false);
  const [justData, setJustData] = useState('');
  const [justTipo, setJustTipo] = useState(TIPOS_JUSTIFICATIVA[0]);
  const [justDesc, setJustDesc] = useState('');
  const [justLoading, setJustLoading] = useState(false);
  const [justErro, setJustErro] = useState('');
  const [justOk, setJustOk] = useState(false);

  // Atestados
  const [atestados, setAtestados] = useState<Atestado[]>(initialAtestados);
  const [ateOpen, setAteOpen] = useState(false);
  const [ateFile, setAteFile] = useState<File | null>(null);
  const [ateData, setAteData] = useState('');
  const [ateLoading, setAteLoading] = useState(false);
  const [ateErro, setAteErro] = useState('');
  const [ateOk, setAteOk] = useState(false);

  const unidadeNome = registros[0]?.unidadeNome ?? '';

  async function handleBaixarPDF() {
    setBaixandoPDF(true);
    try {
      const { generatePontoPDF } = await import('@/lib/generate-pdf');
      await generatePontoPDF({
        nome: nomeCompleto,
        cpf,
        matricula,
        cargo,
        unidadeNome,
        registros,
        assinatura,
        ano,
        mes,
      });
    } finally {
      setBaixandoPDF(false);
    }
  }

  function navMes(delta: number) {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes < 1)  { novoMes = 12; novoAno--; }
    if (novoMes > 12) { novoMes = 1;  novoAno++; }
    router.push(`/espelho?ano=${novoAno}&mes=${novoMes}`);
  }

  async function handleEnviarAtestado(e: React.FormEvent) {
    e.preventDefault();
    setAteErro('');
    setAteOk(false);
    if (!ateFile) { setAteErro('Selecione o arquivo.'); return; }
    if (!ateData) { setAteErro('Informe a data do atestado.'); return; }
    setAteLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', ateFile);
      fd.append('dataAtestado', ateData);
      const res = await fetch('/api/funcionario/atestado', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) { setAteErro(json.error || 'Erro ao enviar.'); return; }
      setAteOk(true);
      const novo: Atestado = {
        id: json.id,
        cpf,
        nomeOriginal: ateFile.name,
        nomeArquivo: ateFile.name,
        googleDriveId: '',
        dataEnvio: new Date().toISOString(),
        dataAtestado: ateData,
        status: 'Pendente',
      };
      setAtestados(prev => [novo, ...prev]);
      setAteFile(null);
      setAteData('');
      setTimeout(() => { setAteOk(false); setAteOpen(false); }, 2500);
    } finally {
      setAteLoading(false);
    }
  }

  async function handleEnviarJustificativa(e: React.FormEvent) {
    e.preventDefault();
    setJustErro('');
    setJustOk(false);
    if (!justData) { setJustErro('Selecione a data.'); return; }
    setJustLoading(true);
    try {
      const res = await fetch('/api/funcionario/justificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: justData, tipo: justTipo, descricao: justDesc }),
      });
      const json = await res.json();
      if (!res.ok) { setJustErro(json.error || 'Erro ao enviar.'); return; }
      setJustOk(true);
      const novaJust: Justificativa = {
        id: Date.now().toString(),
        cpf,
        nome: nomeCompleto,
        data: justData,
        tipo: justTipo,
        descricao: justDesc,
        status: 'Pendente',
        gestorResposta: '',
        createdAt: new Date().toISOString(),
      };
      setJustificativas(prev => [novaJust, ...prev]);
      setJustData('');
      setJustTipo(TIPOS_JUSTIFICATIVA[0]);
      setJustDesc('');
      setTimeout(() => { setJustOk(false); setJustOpen(false); }, 2000);
    } finally {
      setJustLoading(false);
    }
  }

  async function handleAssinar() {
    setAssinando(true);
    setErroAssinatura('');
    const res = await fetch('/api/espelho/assinar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ano, mes }),
    });
    const data = await res.json();
    setAssinando(false);
    if (!res.ok) { setErroAssinatura(data.error || 'Erro ao assinar.'); return; }
    setAssinatura(prev => prev
      ? { ...prev, statusFuncionario: 'Confirmado', assinadoFuncionarioEm: new Date().toISOString() }
      : { id: '', cpf: '', nomeFuncionario: nome, ano, mes,
          statusFuncionario: 'Confirmado', assinadoFuncionarioEm: new Date().toISOString(),
          statusAdmin: 'Pendente', assinadoAdminEm: '', adminCpf: '' }
    );
  }

  // Group by day
  const byDay: Record<string, Registro[]> = {};
  for (const r of registros) {
    const day = r.dataHora.slice(0, 10);
    (byDay[day] ??= []).push(r);
  }
  const days = Object.keys(byDay).sort();

  // Banco de horas
  const banco = calcularBancoHorasMes(registros, ano, mes);
  const bancoByDay: Record<string, number> = {};
  for (const d of banco.detalhesPorDia) bancoByDay[d.data] = d.horasTrabalhadas;

  const saldoPos = banco.saldo >= 0;

  return (
    <main className="min-h-dvh flex flex-col bg-eif-cream pb-safe">
      {/* Header */}
      <header className="bg-eif-red text-white px-4 pt-safe pb-4">
        <div className="max-w-sm mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => router.back()} className="text-white/80 hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <h1 className="font-semibold text-lg flex-1">Espelho do Ponto</h1>
            <button
              onClick={handleBaixarPDF}
              disabled={baixandoPDF}
              title="Baixar PDF do espelho"
              className="text-white/80 hover:text-white disabled:opacity-50 transition flex items-center gap-1.5 text-xs font-medium"
            >
              {baixandoPDF ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 16l-4-4h3V4h2v8h3l-4 4z" />
                  <path d="M4 18h16" strokeLinecap="round" />
                </svg>
              )}
              PDF
            </button>
          </div>
          <p className="text-sm opacity-80">{nome} · Mat. {matricula}</p>
        </div>
      </header>

      <div className="flex-1 px-4 py-6 max-w-sm mx-auto w-full flex flex-col gap-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm px-4 py-3">
          <button onClick={() => navMes(-1)} className="text-eif-red p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="font-semibold text-eif-dark">{MESES[mes - 1]} {ano}</span>
          <button onClick={() => navMes(1)} className="text-eif-red p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Summary + Banco de Horas */}
        <div className="bg-white rounded-xl shadow-sm flex divide-x divide-eif-cream-mid overflow-hidden">
          <div className="flex-1 px-3 py-4 text-center">
            <p className="text-[10px] font-semibold text-eif-text uppercase tracking-widest">Dias</p>
            <p className="font-bold text-eif-dark text-2xl mt-1 tabular-nums">{days.length}</p>
          </div>
          <div className="flex-1 px-3 py-4 text-center">
            <p className="text-[10px] font-semibold text-eif-text uppercase tracking-widest">Trabalhado</p>
            <p className="font-bold text-eif-dark text-2xl mt-1 tabular-nums">{formatHoras(banco.totalTrabalhado)}</p>
          </div>
          <div className="flex-1 px-3 py-4 text-center">
            <p className="text-[10px] font-semibold text-eif-text uppercase tracking-widest">Banco</p>
            <p className={`font-bold text-2xl mt-1 tabular-nums ${saldoPos ? 'text-green-600' : 'text-red-500'}`}>
              {formatHoras(banco.saldo)}
            </p>
          </div>
        </div>

        {/* Expected info */}
        <p className="text-xs text-eif-text text-center -mt-2">
          Esperado: {formatHoras(banco.totalEsperado)} (8h × dias úteis)
        </p>

        {/* Assinatura digital */}
        <div className="bg-white rounded-xl shadow-sm px-4 py-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-eif-text uppercase tracking-wide">Assinatura Digital</p>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-eif-dark font-medium">Sua confirmação</p>
              {assinatura?.statusFuncionario === 'Confirmado' ? (
                <p className="text-xs text-green-600">
                  Confirmado em {new Date(assinatura.assinadoFuncionarioEm).toLocaleDateString('pt-BR')}
                </p>
              ) : (
                <p className="text-xs text-eif-text">Pendente</p>
              )}
            </div>
            {assinatura?.statusFuncionario !== 'Confirmado' && registros.length > 0 && (
              <button
                onClick={handleAssinar}
                disabled={assinando}
                className="text-xs bg-eif-red text-white rounded-lg px-3 py-2 font-medium disabled:opacity-60"
              >
                {assinando ? 'Assinando…' : 'Confirmar e Assinar'}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-eif-cream-mid pt-3">
            <div>
              <p className="text-sm text-eif-dark font-medium">Assinatura do RH</p>
              {assinatura?.statusAdmin === 'Assinado' ? (
                <p className="text-xs text-green-600">
                  Assinado em {new Date(assinatura.assinadoAdminEm).toLocaleDateString('pt-BR')}
                </p>
              ) : (
                <p className="text-xs text-eif-text">
                  {assinatura?.statusFuncionario === 'Confirmado' ? 'Aguardando admin' : 'Aguarda sua confirmação'}
                </p>
              )}
            </div>
            {assinatura?.statusAdmin === 'Assinado' && (
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </div>

          {erroAssinatura && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{erroAssinatura}</p>
          )}
        </div>

        {/* Records by day */}
        {days.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center text-eif-text text-sm">
            Nenhum registro neste mês.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {days.map(day => {
              const recs    = byDay[day];
              const dateObj = new Date(day + 'T12:00:00');
              const horas   = bancoByDay[day] ?? 0;
              return (
                <div key={day} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-eif-cream-mid px-4 py-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-eif-text uppercase tracking-wide">
                      {dateObj.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                    {horas > 0 && (
                      <span className="text-xs font-medium text-eif-dark tabular-nums">
                        {formatHoras(horas)}
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-eif-cream-mid">
                    {recs.map(r => (
                      <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-eif-dark">{r.tipo}</span>
                        <div className="flex items-center gap-2">
                          {r.dentroDoRaio === false && (
                            <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                              Fora do raio
                            </span>
                          )}
                          <span className="text-sm text-eif-text tabular-nums">
                            {new Date(r.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* Atestados */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => { setAteOpen(o => !o); setAteErro(''); setAteOk(false); }}
            className="w-full flex items-center justify-between px-4 py-4"
          >
            <p className="text-xs font-semibold text-eif-text uppercase tracking-wide">Atestados Médicos</p>
            <div className="flex items-center gap-2">
              {atestados.length > 0 && (
                <span className="text-xs bg-eif-cream-mid text-eif-dark rounded-full px-2 py-0.5 font-medium">
                  {atestados.length}
                </span>
              )}
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`text-eif-text transition-transform ${ateOpen ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {ateOpen && (
            <div className="border-t border-eif-cream-mid px-4 pb-4 flex flex-col gap-4 pt-3">
              {atestados.length > 0 && (
                <div className="flex flex-col gap-2">
                  {atestados.map(a => (
                    <div key={a.id} className="rounded-lg border border-eif-cream-mid p-3 flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-eif-dark truncate">{a.nomeOriginal}</p>
                        <p className="text-xs text-eif-text mt-0.5">
                          Data: {new Date(a.dataAtestado + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </p>
                        <p className="text-xs text-eif-text">
                          Enviado: {new Date(a.dataEnvio).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <span className={`text-xs rounded-full px-2 py-0.5 font-medium shrink-0 ${
                        a.status === 'Aprovado' ? 'bg-green-100 text-green-700' :
                        a.status === 'Recusado' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleEnviarAtestado} className="flex flex-col gap-3">
                <p className="text-xs font-semibold text-eif-dark">Enviar novo atestado</p>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-eif-text">Data do atestado</label>
                  <input
                    type="date"
                    value={ateData}
                    onChange={e => setAteData(e.target.value)}
                    className="w-full border border-eif-cream-mid rounded-lg px-3 py-2 text-sm text-eif-dark bg-white focus:outline-none focus:ring-2 focus:ring-eif-red/30"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-eif-text">Arquivo (PDF, JPG ou PNG · máx. 5 MB)</label>
                  <label className="flex items-center gap-3 border border-eif-cream-mid rounded-lg px-3 py-2.5 cursor-pointer bg-white hover:bg-eif-cream/50 transition">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-eif-red shrink-0">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span className="text-sm text-eif-text truncate flex-1">
                      {ateFile ? ateFile.name : 'Escolher arquivo…'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={e => { setAteFile(e.target.files?.[0] ?? null); setAteErro(''); }}
                    />
                  </label>
                </div>
                {ateErro && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{ateErro}</p>
                )}
                {ateOk && (
                  <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">Atestado enviado com sucesso!</p>
                )}
                <button
                  type="submit"
                  disabled={ateLoading}
                  className="bg-eif-red text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {ateLoading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                      </svg>
                      Enviando…
                    </>
                  ) : 'Enviar Atestado'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Justificativas */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => { setJustOpen(o => !o); setJustErro(''); setJustOk(false); }}
            className="w-full flex items-center justify-between px-4 py-4"
          >
            <p className="text-xs font-semibold text-eif-text uppercase tracking-wide">Justificativas do Mês</p>
            <div className="flex items-center gap-2">
              {justificativas.length > 0 && (
                <span className="text-xs bg-eif-cream-mid text-eif-dark rounded-full px-2 py-0.5 font-medium">
                  {justificativas.length}
                </span>
              )}
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`text-eif-text transition-transform ${justOpen ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {justOpen && (
            <div className="border-t border-eif-cream-mid px-4 pb-4 flex flex-col gap-4 pt-3">
              {/* Existing justificativas */}
              {justificativas.length > 0 && (
                <div className="flex flex-col gap-2">
                  {justificativas.map(j => (
                    <div key={j.id} className="rounded-lg border border-eif-cream-mid p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-eif-dark">
                            {new Date(j.data + 'T12:00:00').toLocaleDateString('pt-BR')} · {j.tipo}
                          </p>
                          <p className="text-xs text-eif-text mt-0.5 line-clamp-2">{j.descricao}</p>
                          {j.gestorResposta && (
                            <p className="text-xs text-eif-text mt-1 italic">Resposta: {j.gestorResposta}</p>
                          )}
                        </div>
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium shrink-0 ${
                          j.status === 'Aprovada' ? 'bg-green-100 text-green-700' :
                          j.status === 'Recusada' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {j.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* New justification form */}
              <form onSubmit={handleEnviarJustificativa} className="flex flex-col gap-3">
                <p className="text-xs font-semibold text-eif-dark">Nova justificativa</p>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-eif-text">Data</label>
                  <input
                    type="date"
                    value={justData}
                    onChange={e => setJustData(e.target.value)}
                    min={`${ano}-${String(mes).padStart(2, '0')}-01`}
                    max={`${ano}-${String(mes).padStart(2, '0')}-31`}
                    className="w-full border border-eif-cream-mid rounded-lg px-3 py-2 text-sm text-eif-dark bg-white focus:outline-none focus:ring-2 focus:ring-eif-red/30"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-eif-text">Tipo</label>
                  <select
                    value={justTipo}
                    onChange={e => setJustTipo(e.target.value)}
                    className="w-full border border-eif-cream-mid rounded-lg px-3 py-2 text-sm text-eif-dark bg-white focus:outline-none focus:ring-2 focus:ring-eif-red/30"
                  >
                    {TIPOS_JUSTIFICATIVA.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-eif-text">Descrição</label>
                  <textarea
                    value={justDesc}
                    onChange={e => setJustDesc(e.target.value)}
                    rows={3}
                    placeholder="Descreva o motivo da ausência…"
                    className="w-full border border-eif-cream-mid rounded-lg px-3 py-2 text-sm text-eif-dark bg-white resize-none focus:outline-none focus:ring-2 focus:ring-eif-red/30"
                    required
                  />
                </div>
                {justErro && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{justErro}</p>
                )}
                {justOk && (
                  <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">Justificativa enviada com sucesso!</p>
                )}
                <button
                  type="submit"
                  disabled={justLoading}
                  className="bg-eif-red text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-60"
                >
                  {justLoading ? 'Enviando…' : 'Enviar Justificativa'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
