import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getFuncionarioByCPF } from '@/lib/google-sheets';
import { cleanCPF, validateCPF } from '@/lib/cpf';
import { authConfig } from '@/lib/auth.config';
import { verifyWebAuthnToken } from '@/lib/webauthn-token';

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        cpf:           { label: 'CPF',           type: 'text' },
        senha:         { label: 'Senha',         type: 'password' },
        webauthnToken: { label: 'WebAuthn Token', type: 'text' },
      },
      async authorize(credentials) {
        const cpf          = cleanCPF(String(credentials?.cpf          ?? ''));
        const webauthnToken = String(credentials?.webauthnToken ?? '');

        if (!validateCPF(cpf)) return null;

        const func = await getFuncionarioByCPF(cpf);
        if (!func || !func.ativo) return null;

        if (webauthnToken) {
          // WebAuthn path — verify short-lived signed token
          const result = verifyWebAuthnToken(webauthnToken);
          if (!result || result.cpf !== cpf) return null;
        } else {
          // Password path
          const senha = String(credentials?.senha ?? '');
          if (!senha || senha.length < 4) return null;
          const valid = await bcrypt.compare(senha, func.senhaHash);
          if (!valid) return null;
        }

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
