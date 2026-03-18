'use client';

import { useOnboardingProgress, useUpdateOnboarding } from '@/hooks/use-imports';
import { useRouter } from 'next/navigation';

const STEPS = [
  {
    id: 'office_setup',
    title: 'Set Up Your Office',
    description: 'Configure your office name, address, and branding',
    icon: '🏢',
    href: '/settings',
  },
  {
    id: 'invite_team',
    title: 'Invite Your Team',
    description: 'Add agents, assistants, and team members',
    icon: '👥',
    href: '/team',
  },
  {
    id: 'connect_portals',
    title: 'Connect Portals',
    description: 'Sync with Domain.com.au and other property portals',
    icon: '🔗',
    href: '/settings/integrations/domain',
  },
  {
    id: 'import_data',
    title: 'Import Your Data',
    description: 'Bring your contacts and properties from your old CRM',
    icon: '📁',
    href: '/imports',
  },
  {
    id: 'configure_pipelines',
    title: 'Configure Pipelines',
    description: 'Customize buyer and seller pipeline stages',
    icon: '📊',
    href: '/pipeline',
  },
  {
    id: 'setup_workflows',
    title: 'Set Up Automation',
    description: 'Enable workflow templates for follow-ups and notifications',
    icon: '⚡',
    href: '/workflows',
  },
];

export default function OnboardingPage() {
  const { data: progress, isLoading } = useOnboardingProgress();
  const updateOnboarding = useUpdateOnboarding();
  const router = useRouter();

  const progressData = progress as Record<string, unknown> | undefined;
  const completedSteps = (progressData?.completed_steps as string[]) ?? [];
  const skippedSteps = (progressData?.skipped_steps as string[]) ?? [];
  const currentStep = (progressData?.current_step as string) ?? 'office_setup';

  const handleComplete = (stepId: string) => {
    const newCompleted = [...completedSteps, stepId];
    const currentIdx = STEPS.findIndex(s => s.id === stepId);
    const nextStep = STEPS[currentIdx + 1];

    updateOnboarding.mutate({
      currentStep: nextStep?.id ?? 'complete',
      completedSteps: newCompleted,
    });
  };

  const handleSkip = (stepId: string) => {
    const newSkipped = [...skippedSteps, stepId];
    const currentIdx = STEPS.findIndex(s => s.id === stepId);
    const nextStep = STEPS[currentIdx + 1];

    updateOnboarding.mutate({
      currentStep: nextStep?.id ?? 'complete',
      skippedSteps: newSkipped,
    });
  };

  const completedCount = completedSteps.length;
  const totalSteps = STEPS.length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  if (progressData?.is_complete) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">You're All Set!</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">RealFlow is ready to use. Let's get to work.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-6 rounded-lg bg-brand-600 px-6 py-3 text-sm font-medium text-white hover:bg-brand-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Welcome to RealFlow</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">Let's get your account set up in a few steps</p>
      </div>

      {/* Progress Bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Setup Progress</span>
          <span className="text-sm text-gray-500">{completedCount} of {totalSteps} complete</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
          <div
            className="h-2 rounded-full bg-brand-600 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {STEPS.map((step) => {
            const isCompleted = completedSteps.includes(step.id);
            const isSkipped = skippedSteps.includes(step.id);
            const isCurrent = currentStep === step.id;

            return (
              <div
                key={step.id}
                className={`rounded-xl border p-4 ${
                  isCurrent
                    ? 'border-brand-300 bg-brand-50 shadow-sm dark:border-brand-600 dark:bg-brand-900/20'
                    : isCompleted
                      ? 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
                      : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{isCompleted ? '✅' : step.icon}</span>
                    <div>
                      <h3 className={`font-medium ${isCompleted ? 'text-green-700 dark:text-green-300' : 'text-gray-900 dark:text-gray-100'}`}>
                        {step.title}
                        {isSkipped && <span className="ml-2 text-xs text-gray-400">(skipped)</span>}
                      </h3>
                      <p className="text-sm text-gray-500">{step.description}</p>
                    </div>
                  </div>
                  {isCurrent && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { router.push(step.href); handleComplete(step.id); }}
                        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                      >
                        Start
                      </button>
                      <button
                        onClick={() => handleSkip(step.id)}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-600"
                      >
                        Skip
                      </button>
                    </div>
                  )}
                  {isCompleted && !isCurrent && (
                    <span className="text-sm text-green-600">Done</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
