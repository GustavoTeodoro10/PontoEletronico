'use client';

import { useState, useRef } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatCPF, cleanCPF, validateCPF } from '@/lib/cpf';
import EIF_LOGO from '@/lib/eif-logo';

export default function LoginContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl  = searchParams.get('callbackUrl') || '/dashboard';
  const senhaAlterada = searchParams.get('senhaAlterada') === '1';

  const [cpf,      setCpf]      = useState('');
  const [senha,    setSenha]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [erro,     setErro]     = useState('');

  const senhaRef = useRef<HTMLInputElement>(null);

  function handleCpfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = cleanCPF(e.target.value);
    if (digits.length <= 11) {
      setCpf(formatCPF(digits));
      if (digits.length === 11) senhaRef.current?.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    const cpfLimpo = cleanCPF(cpf);
    if (!validateCPF(cpfLimpo)) {
      setErro('CPF inválido.');
      return;
    }
    if (!senha) {
      setErro('Informe a senha.');
      return;
    }

    setLoading(true);
    const result = await signIn('credentials', {
      cpf: cpfLimpo,
      senha,
      redirect: false,
    });
    setLoading(false);

    if (result?.error) {
      setErro('CPF ou senha incorretos.');
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center bg-eif-cream px-4 pb-safe">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src={EIF_LOGO} alt="e.I.F Refeições Coletivas" className="w-32 h-32 mb-4 drop-shadow-lg object-contain" />
          <h1 className="text-eif-dark font-semibold text-xl">EIF Ponto Eletrônico</h1>
          <p className="text-eif-text text-sm mt-1">E.I.F Alimentos</p>
        </div>

        {/* Banner senha alterada */}
        {senhaAlterada && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 text-sm text-green-700 text-center">
            Senha alterada com sucesso. Faça o login com a nova senha.
          </div>
        )}

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-lg border border-eif-cream-mid p-6 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="cpf" className="text-xs font-semibold text-eif-text uppercase tracking-wide">
              CPF
            </label>
            <input
              id="cpf"
              type="text"
              inputMode="numeric"
              autoComplete="username"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={handleCpfChange}
              className="border border-eif-cream-dark rounded-xl px-4 py-3 text-eif-dark text-base
                         focus:outline-none focus:ring-2 focus:ring-eif-red/40 focus:border-eif-red
                         placeholder:text-eif-cream-dark transition"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="senha" className="text-xs font-semibold text-eif-text uppercase tracking-wide">
              Senha
            </label>
            <input
              id="senha"
              ref={senhaRef}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={senha}
              onChange={e => setSenha(e.target.value)}
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
                       active:bg-eif-red-dark transition disabled:opacity-60 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Entrando…
              </>
            ) : 'Entrar'}
          </button>

          <p className="text-center text-xs text-eif-text/60 leading-snug">
            Acesso restrito a funcionários<br />E.I.F Alimentos
          </p>

          <p className="text-center text-xs text-eif-text mt-1">
            Esqueceu a senha? Fale com o RH.
          </p>
        </form>

      </div>
    </main>
  );
}
