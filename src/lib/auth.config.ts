import type { NextAuthConfig } from 'next-auth';
import type { Funcionario } from '@/types';

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
    error:  '/login',
  },

  providers: [],

  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path       = nextUrl.pathname;
      const isPublic   = path.startsWith('/login') || path.startsWith('/api/auth');

      if (!isLoggedIn && !isPublic) return false; // → redirects to signIn (/login)

      if (isLoggedIn && path.startsWith('/login')) {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }

      if (path.startsWith('/admin')) {
        const role = (auth?.user as { role?: string })?.role;
        if (role !== 'admin' && role !== 'gestor') {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }
      }

      return true;
    },

    jwt({ token, user, trigger, session }) {
      if (user) {
        token.cpf                = (user as unknown as Funcionario).cpf;
        token.matricula          = (user as unknown as Funcionario).matricula;
        token.nome               = (user as unknown as Funcionario).nome;
        token.primeiroNome       = (user as unknown as Funcionario).primeiroNome;
        token.unidadeId          = (user as unknown as Funcionario).unidadeId;
        token.role               = (user as unknown as Funcionario).role;
        token.mustChangePassword = (user as unknown as { mustChangePassword: boolean }).mustChangePassword;
      }
      if (trigger === 'update' && session?.mustChangePassword !== undefined) {
        token.mustChangePassword = session.mustChangePassword;
      }
      return token;
    },

    session({ session, token }) {
      session.user = {
        ...session.user,
        cpf:               token.cpf as string,
        matricula:         token.matricula as string,
        nome:              token.nome as string,
        primeiroNome:      token.primeiroNome as string,
        unidadeId:         token.unidadeId as string,
        role:              token.role as Funcionario['role'],
        mustChangePassword:token.mustChangePassword as boolean,
      };
      return session;
    },
  },
};
