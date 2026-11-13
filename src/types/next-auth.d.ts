import type { DefaultSession, DefaultJWT } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      cpf: string;
      matricula: string;
      nome: string;
      primeiroNome: string;
      unidadeId: string;
      cargo: string;
      role: 'funcionario' | 'gestor' | 'admin';
      mustChangePassword: boolean;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    cpf?: string;
    matricula?: string;
    nome?: string;
    primeiroNome?: string;
    unidadeId?: string;
    cargo?: string;
    role?: 'funcionario' | 'gestor' | 'admin';
    mustChangePassword?: boolean;
  }
}
