'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type AuthState = 'idle' | 'loading' | 'success' | 'error';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<AuthState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) return;

    setState('loading');
    setErrorMessage('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setState('error');
      setErrorMessage(error.message);
    } else {
      setState('success');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-portal-600">
            <span className="text-lg font-bold text-white">BP</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">BuyerPilot</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your client portal</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {state === 'success' ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-gray-900">Check your email</h2>
              <p className="mt-2 text-sm text-gray-500">
                We have sent a magic link to <span className="font-medium text-gray-700">{email}</span>.
                Click the link to sign in to your portal.
              </p>
              <button
                type="button"
                onClick={() => {
                  setState('idle');
                  setEmail('');
                }}
                className="mt-6 text-sm font-medium text-portal-600 hover:text-portal-700"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-portal-500 focus:outline-none focus:ring-2 focus:ring-portal-200"
                />
              </div>

              {state === 'error' && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {errorMessage || 'Something went wrong. Please try again.'}
                </div>
              )}

              <button
                type="submit"
                disabled={state === 'loading' || !email.trim()}
                className="w-full rounded-lg bg-portal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-portal-700 disabled:opacity-50"
              >
                {state === 'loading' ? 'Sending link...' : 'Send magic link'}
              </button>

              <p className="text-center text-xs text-gray-400">
                You will receive a secure link to sign in. No password required.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
