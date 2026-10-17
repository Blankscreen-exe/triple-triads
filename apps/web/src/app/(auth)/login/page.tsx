import type { Metadata } from 'next';
import { logIn } from '../actions';
import { AuthForm } from '../auth-form';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <main className="px-4 py-12">
      <AuthForm mode="login" action={logIn} />
    </main>
  );
}
