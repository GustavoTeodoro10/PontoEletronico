import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getFuncionarioByCPF } from '@/lib/google-sheets';
import { cleanCPF, validateCPF } from '@/lib/cpf';
import { authConfig } from '@/lib/auth.config';
import type { Funcionario } from '@/types';

declare module 'next-auth' {
  interface Session {
    user: {
      cpf: string;
      matricula: string;
      nome: string;
      primeiroNome: string;
      unidadeId: string;
      role: Funcionario['role'];
      mustChangePassword: boolean;
    };
  }
  interface User {
    cpf: string;
    matricula: string;
    nome: string;
    primeiroNome: string;
    unidadeId: string;
    role: Funcionario['role'];
    mustChangePassword: boolean;
  }
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        cpf:   { label: 'CPF',   type: 'text' },
        senha: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        const cpf   = cleanCPF(String(credentials?.cpf   ?? ''));
        const senha = String(credentials?.senha ?? '');

        if (!validateCPF(cpf)) return null;
        if (!senha || senha.length < 4) return null;

        const func = await getFuncionarioByCPF(cpf);
        if (!func || !func.ativo) return null;

        const valid = await bcrypt.compare(senha, func.senhaHash);
        if (!valid) return null;

        return {
          id:                func.cpf,
          cpf:               func.cpf,
          matricula:         func.matricula,
          nome:              func.nome,
          primeiroNome:      func.primeiroNome,
          unidadeId:         func.unidadeId,
          role:              func.role,
          mustChangePassword:func.mustChangePassword,
        };
      },
    }),
  ],

  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
});
