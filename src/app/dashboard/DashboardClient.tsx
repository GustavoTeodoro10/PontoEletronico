'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import SlideButton from '@/components/SlideButton';
import type { Unidade, Registro, PunchType } from '@/types';

const CICLO: PunchType[] = ['Entrada', 'Saída Almoço', 'Entrada Almoço', 'Saída'];

interface Props {
  funcionario: {
    cpf: string; matricula: string; nome: string; primeiroNome: string;
    unidadeId: string; role: string;
  };
  unidade: Unidade | null;
  proximoTipo: PunchType;
  ultimoRegistro: Registro | null;
  registrosHoje: Registro[];
}

export default function DashboardClient({
  funcionario, unidade, proximoTipo: initialTipo, registrosHoje: initialRegistros,
}: Props) {
  const router = useRouter();

  const [tipo,         setTipo]         = useState(initialTipo);
  const [registros,    setRegistros]    = useState(initialRegistros);
  const [loading,      setLoading]      = useState(false);
  const [mensagem,     setMensagem]     = useState('');
  const [erro,         setErro]         = useState('');
  const [hora,         setHora]         = useState('');
  const cicloIdx = CICLO.indexOf(tipo);

  // Live clock
  useEffect(() => {
    function tick() {
      setHora(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  async function handlePunch() {
    setLoading(true);
    setErro('');
    setMensagem('');

    let lat: number | undefined;
    let lon: number | undefined;

    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      );
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    } catch {
      // GPS not available — allowed, records null
    }

    const deviceId = localStorage.getItem('eif-device-id') || (() => {
      const id = crypto.randomUUID();
      localStorage.setItem('eif-device-id', id);
      return id;
    })();

    const res = await fetch('/api/punch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lon, deviceId }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setErro(data.error || 'Erro ao registrar ponto.');
      return;
    }

    setRegistros(prev => [data.registro, ...prev]);
    setTipo(proximoFromTipo(tipo));
    setMensagem(`${tipo} registrada com sucesso!`);

    if (data.alertaRH) {
      setMensagem(prev => prev + ' (fora do raio — RH notificado)');
    }

    setTimeout(() => setMensagem(''), 5000);
    router.refresh();
  }

  return (
    <main className="min-h-dvh flex flex-col bg-eif-cream pb-safe">
      {/* Header */}
      <header className="bg-eif-red text-white px-4 pt-safe pb-4">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <div>
            <p className="text-xs opacity-70 font-medium uppercase tracking-wide">Olá,</p>
            <h1 className="font-semibold text-lg leading-tight">{funcionario.primeiroNome}</h1>
            {unidade && <p className="text-xs opacity-80 mt-0.5">{unidade.nome}</p>}
          </div>
          <div className="flex items-center gap-3">
            {(funcionario.role === 'admin' || funcionario.role === 'gestor') && (
              <button
                onClick={() => router.push('/admin')}
                className="text-xs bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 font-medium transition"
              >
                Painel
              </button>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-xs bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 font-medium transition"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 py-6 max-w-sm mx-auto w-full flex flex-col gap-6">
        {/* Clock */}
        <div className="text-center">
          <p className="text-eif-text text-sm">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <p className="text-eif-dark font-semibold text-5xl tabular-nums mt-1">{hora}</p>
        </div>

        {/* Próximo tipo */}
        <div className="bg-white rounded-2xl shadow-sm p-5 text-center">
          <p className="text-[10px] text-eif-text font-semibold uppercase tracking-widest mb-4">Próximo Registro</p>
          {/* Cycle progress indicator */}
          <div className="flex items-center justify-center mb-4">
            {CICLO.map((_, i) => (
              <div key={i} className="flex items-center">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 transition-all ${
                  i < cicloIdx  ? 'bg-eif-red' :
                  i === cicloIdx ? 'bg-eif-red shadow-[0_0_0_4px_rgba(191,38,38,0.2)]' :
                  'bg-eif-cream-dark'
                }`} />
                {i < 3 && (
                  <div className={`w-8 h-px flex-shrink-0 ${i < cicloIdx ? 'bg-eif-red/50' : 'bg-eif-cream-dark'}`} />
                )}
              </div>
            ))}
          </div>
          <p className="text-eif-red font-bold text-2xl">{tipo}</p>
          <p className="text-[10px] text-eif-text/50 mt-1">passo {cicloIdx + 1} de 4</p>
        </div>

        {/* Mensagem/Erro */}
        {mensagem && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
            {mensagem}
          </div>
        )}
        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        {/* Slide Button */}
        <div>
          <SlideButton
            label={`Deslize para registrar ${tipo}`}
            onConfirm={handlePunch}
            disabled={loading}
          />
          <p className="text-center text-xs text-eif-text mt-2">
            Segure no final por 3 segundos para confirmar
          </p>
        </div>

        {/* Registros de hoje */}
        {registros.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-eif-text uppercase tracking-wide mb-2">Hoje</p>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-eif-cream-mid">
              {registros.map(r => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-eif-red flex-shrink-0" />
                    <span className="text-sm font-medium text-eif-dark">{r.tipo}</span>
                  </div>
                  <span className="text-sm text-eif-text tabular-nums font-medium">
                    {new Date(r.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/espelho')}
            className="flex-1 bg-white rounded-xl shadow-sm py-3 text-sm font-medium text-eif-red border border-eif-cream-dark hover:bg-eif-cream transition"
          >
            Espelho do Ponto
          </button>
        </div>
      </div>
    </main>
  );
}

function proximoFromTipo(atual: PunchType): PunchType {
  const ciclo: PunchType[] = ['Entrada', 'Saída Almoço', 'Entrada Almoço', 'Saída'];
  // Simple round-robin based on current type
  const map: Record<PunchType, PunchType> = {
    'Entrada':        'Saída Almoço',
    'Saída Almoço':   'Entrada Almoço',
    'Entrada Almoço': 'Saída',
    'Saída':          'Entrada',
  };
  return map[atual] ?? 'Entrada';
}
