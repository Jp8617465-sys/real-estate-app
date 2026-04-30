'use client';

import { useState } from 'react';
import { WaitlistForm } from './waitlist-form';

interface Question {
  id: string;
  text: string;
  detail: string;
  options: { label: string; value: string; points: number }[];
}

const QUESTIONS: Question[] = [
  {
    id: 'austrac_registered',
    text: '1. Have you registered with AUSTRAC as a reporting entity?',
    detail: 'From July 1, 2026, all buyer\'s agents must be registered with AUSTRAC under Tranche 2.',
    options: [
      { label: 'Yes', value: 'yes', points: 20 },
      { label: 'In progress', value: 'in_progress', points: 10 },
      { label: 'No', value: 'no', points: 0 },
      { label: 'Unsure', value: 'unsure', points: 0 },
    ],
  },
  {
    id: 'id_verification',
    text: '2. Do you have a documented 100-point ID verification process for every client?',
    detail: 'AML/CTF requires verifying client identity with primary docs (passport, birth cert) plus supporting docs totalling 100+ points.',
    options: [
      { label: 'Yes, documented', value: 'yes', points: 20 },
      { label: 'Partially', value: 'partial', points: 10 },
      { label: 'No formal process', value: 'no', points: 0 },
    ],
  },
  {
    id: 'record_keeping',
    text: '3. Can you produce client verification records on request?',
    detail: 'AUSTRAC requires you to retain identity documents and verification records for a minimum of 7 years.',
    options: [
      { label: 'Yes, digitally stored', value: 'yes', points: 20 },
      { label: 'Paper files somewhere', value: 'paper', points: 5 },
      { label: 'No system', value: 'no', points: 0 },
    ],
  },
  {
    id: 'verification_method',
    text: '4. Do you record HOW identity was verified for audit purposes?',
    detail: 'You must document whether verification was face-to-face, via certified copies, electronic, or through a third party.',
    options: [
      { label: 'Yes, always', value: 'yes', points: 15 },
      { label: 'Sometimes', value: 'sometimes', points: 5 },
      { label: 'No', value: 'no', points: 0 },
    ],
  },
  {
    id: 'smr_process',
    text: '5. Do you have a process for reporting suspicious matters to AUSTRAC?',
    detail: 'Buyer\'s agents must file Suspicious Matter Reports (SMRs) when they identify suspicious transactions or client behaviour.',
    options: [
      { label: 'Yes, documented', value: 'yes', points: 15 },
      { label: 'I know the concept', value: 'aware', points: 5 },
      { label: 'No process', value: 'no', points: 0 },
      { label: 'Didn\'t know this was required', value: 'unaware', points: 0 },
    ],
  },
  {
    id: 'expiry_tracking',
    text: '6. Do you track verification expiry dates and renewals?',
    detail: 'Identity verifications typically expire after 2 years. You need alerts for re-verification of ongoing clients.',
    options: [
      { label: 'Yes, automated', value: 'yes', points: 10 },
      { label: 'Manual tracking', value: 'manual', points: 5 },
      { label: 'No tracking', value: 'no', points: 0 },
    ],
  },
];

const MAX_SCORE = QUESTIONS.reduce((sum, q) => sum + Math.max(...q.options.map(o => o.points)), 0);

function getReadiness(score: number): { label: string; color: string; message: string } {
  const pct = (score / MAX_SCORE) * 100;
  if (pct >= 80) return { label: 'Well Prepared', color: 'text-green-600 dark:text-green-400', message: 'You\'re ahead of most buyer\'s agents. RealFlow can automate what you\'re doing manually.' };
  if (pct >= 50) return { label: 'Partially Ready', color: 'text-yellow-600 dark:text-yellow-400', message: 'You\'ve started, but gaps remain before July 1. RealFlow closes them.' };
  if (pct >= 25) return { label: 'At Risk', color: 'text-orange-600 dark:text-orange-400', message: 'Significant compliance gaps. July 1 is 3 months away. RealFlow can get you ready.' };
  return { label: 'Not Prepared', color: 'text-red-600 dark:text-red-400', message: 'You need to act now. AUSTRAC penalties are severe. RealFlow handles the entire compliance workflow.' };
}

interface ComplianceCalculatorProps {
  variant?: string | null;
  referrer?: string | null;
}

export function ComplianceCalculator({ variant, referrer }: ComplianceCalculatorProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);

  const score = QUESTIONS.reduce((sum, q) => {
    const answer = answers[q.id];
    if (!answer) return sum;
    const option = q.options.find(o => o.value === answer);
    return sum + (option?.points ?? 0);
  }, 0);

  const allAnswered = QUESTIONS.every(q => answers[q.id]);
  const readiness = getReadiness(score);

  function handleAnswer(questionId: string, value: string) {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }

  if (showResults) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-900 sm:p-8">
        <div className="text-center">
          <div className="mb-2 text-5xl font-bold text-gray-900 dark:text-white">
            {score}<span className="text-2xl text-gray-400">/{MAX_SCORE}</span>
          </div>
          <p className={`text-lg font-semibold ${readiness.color}`}>{readiness.label}</p>
          <p className="mx-auto mt-3 max-w-md text-sm text-gray-600 dark:text-gray-400">
            {readiness.message}
          </p>
        </div>

        <div className="mt-8">
          <p className="mb-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
            Get your full compliance readiness report + the 68-item DD checklist:
          </p>
          <WaitlistForm
            source="calculator"
            variant={variant}
            referrer={referrer}
            complianceScore={score}
            complianceAnswers={answers}
            buttonText="Send my report"
            className="mx-auto max-w-md"
          />
        </div>

        <button
          onClick={() => { setShowResults(false); setAnswers({}); }}
          className="mt-4 block w-full text-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Retake assessment
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-900 sm:p-8">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
        Are you ready for July 1?
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        6 questions. 2 minutes. See where you stand on AUSTRAC Tranche 2.
      </p>

      <div className="mt-6 space-y-6">
        {QUESTIONS.map((q) => (
          <div key={q.id}>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{q.text}</p>
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{q.detail}</p>
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleAnswer(q.id, opt.value)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    answers[q.id] === opt.value
                      ? 'border-primary-500 bg-primary-50 font-medium text-primary-700 dark:bg-primary-950 dark:text-primary-300'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setShowResults(true)}
        disabled={!allAnswered}
        className="mt-6 w-full rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        See my compliance score
      </button>

      {!allAnswered && (
        <p className="mt-2 text-center text-xs text-gray-400">
          Answer all 6 questions to see your score
        </p>
      )}
    </div>
  );
}
