import type { Metadata } from 'next';
import { signUp } from '../actions';
import { AuthForm } from '../auth-form';

export const metadata: Metadata = { title: 'Sign up' };

export default function SignupPage() {
  return (
    <main className="px-4 py-12">
      <AuthForm mode="signup" action={signUp} />
    </main>
  );
}
