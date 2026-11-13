'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TrocarSenhaPage() {
  const router = useRouter();
  const [novaSenha,  setNovaSenha]  = useState('');
  const [confirmar,  setConfirmar]  = useState('');
  const [loading,    setLoading]    = useState(false);
  const [erro,       setErro]       = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    if (novaSenha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmar) {
      setErro('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    const res  = await fetch('/api/trocar-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ novaSenha }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setErro(data.error || 'Erro ao trocar senha.');
      return;
    }

    // Hard redirect para forçar refresh completo do JWT na sessão
    window.location.href = '/dashboard';
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center bg-eif-cream px-4 pb-safe">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-eif-red flex items-center justify-center mx-auto mb-4 shadow-[0_4px_16px_-4px_rgba(191,38,38,0.4)]">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-eif-dark font-semibold text-xl">Trocar Senha</h1>
          <p className="text-eif-text text-sm mt-1">Crie uma nova senha para continuar</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-lg border border-eif-cream-mid p-6 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-eif-text uppercase tracking-wide">
              Nova senha
            </label>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              value={novaSenha}
              onChange={e => setNovaSenha(e.target.value)}
              className="border border-eif-cream-dark rounded-xl px-4 py-3 text-eif-dark text-base
                         focus:outline-none focus:ring-2 focus:ring-eif-red/40 focus:border-eif-red
                         placeholder:text-eif-cream-dark transition"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-eif-text uppercase tracking-wide">
              Confirmar senha
            </label>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              className="border border-eif-cream-dark rounded-xl px-4 py-3 text-eif-dark text-base
                         focus:outline-none focus:ring-2 focus:ring-eif-red/40 focus:border-eif-red
                         placeholder:text-eif-cream-dark transition"
            />
          </div>

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{erro}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-eif-red text-white font-semibold text-base rounded-xl py-3 mt-1
                       active:bg-eif-red-dark transition disabled:opacity-60"
          >
            {loading ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </main>
  );
}
