import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export const instant = false;

export default async function RootPage() {
  const session = await auth();
  redirect(session ? '/dashboard' : '/login');
}
