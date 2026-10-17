'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Window } from '@/components/ui/window';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from '@/lib/validation/credentials';
import type { AuthFormState } from './actions';

type AuthAction = (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;

interface AuthFormProps {
  readonly mode: 'login' | 'signup';
  readonly action: AuthAction;
}

const COPY = {
  login: {
    title: 'Log in',
    submit: 'Log in',
    pending: 'Logging in…',
    switchText: 'New here?',
    switchLink: 'Create an account',
    switchHref: '/signup',
  },
  signup: {
    title: 'Create an account',
    submit: 'Sign up',
    pending: 'Creating account…',
    switchText: 'Already have an account?',
    switchLink: 'Log in',
    switchHref: '/login',
  },
} as const;

const INITIAL_STATE: AuthFormState = { error: null, username: '' };

export function AuthForm({ mode, action }: AuthFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const copy = COPY[mode];
  const isSignup = mode === 'signup';

  return (
    <Window className="mx-auto w-full max-w-sm p-6">
      <h1 className="font-display text-2xl font-bold tracking-wider text-cream">{copy.title}</h1>

      <form action={formAction} className="mt-6 space-y-4">
        <TextField
          label="Username"
          name="username"
          autoComplete="username"
          required
          minLength={USERNAME_MIN_LENGTH}
          maxLength={USERNAME_MAX_LENGTH}
          pattern={USERNAME_PATTERN}
          defaultValue={state.username}
          hint={
            isSignup
              ? `${String(USERNAME_MIN_LENGTH)}–${String(USERNAME_MAX_LENGTH)} letters, numbers, _ or -`
              : undefined
          }
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          hint={isSignup ? `At least ${String(PASSWORD_MIN_LENGTH)} characters` : undefined}
        />

        {state.error && (
          <p role="alert" className="rounded-md bg-status-live/30 px-3 py-2 text-sm text-slate-100">
            {state.error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? copy.pending : copy.submit}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-300/80">
        {copy.switchText}{' '}
        <Link
          href={copy.switchHref}
          className="font-semibold text-cream underline-offset-4 hover:underline"
        >
          {copy.switchLink}
        </Link>
      </p>
    </Window>
  );
}
