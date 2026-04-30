'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface WaitlistFormProps {
  source: 'hero' | 'calculator' | 'footer' | 'dd-checklist';
  variant?: string | null;
  referrer?: string | null;
  complianceScore?: number | null;
  complianceAnswers?: Record<string, string> | null;
  buttonText?: string;
  placeholder?: string;
  className?: string;
}

export function WaitlistForm({
  source,
  variant,
  referrer,
  complianceScore,
  complianceAnswers,
  buttonText = 'Join the waitlist',
  placeholder = 'you@example.com.au',
  className = '',
}: WaitlistFormProps) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setState('loading');
    setErrorMsg('');

    try {
      const supabase = createClient();
      const { error } = await supabase.from('waitlist_signups').upsert(
        {
          email: email.trim().toLowerCase(),
          source,
          variant: variant ?? undefined,
          ref: referrer ?? undefined,
          compliance_score: complianceScore ?? undefined,
          compliance_answers: complianceAnswers ?? undefined,
        },
        { onConflict: 'email' },
      );

      if (error) throw error;
      setState('success');
    } catch {
      setState('error');
      setErrorMsg('Something went wrong. Try again.');
    }
  }

  if (state === 'success') {
    return (
      <div className={`rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-950 ${className}`}>
        <p className="font-semibold text-green-800 dark:text-green-200">
          You&apos;re on the list.
        </p>
        <p className="mt-1 text-sm text-green-600 dark:text-green-400">
          We&apos;ll send the DD checklist to {email} shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-3 sm:flex-row ${className}`}>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
      />
      <button
        type="submit"
        disabled={state === 'loading'}
        className="rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50"
      >
        {state === 'loading' ? 'Submitting...' : buttonText}
      </button>
      {state === 'error' && (
        <p className="text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
      )}
    </form>
  );
}
