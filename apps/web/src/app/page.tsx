'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { Shield, Calendar, FileCheck, Users, Activity, Smartphone } from 'lucide-react';
import { WaitlistForm } from './components/landing/waitlist-form';
import { ComplianceCalculator } from './components/landing/compliance-calculator';
import { ComparisonTable } from './components/landing/comparison-table';

function LandingContent() {
  const searchParams = useSearchParams();
  const variant = searchParams.get('v') ?? 'F';
  const referrer = searchParams.get('ref');

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Nav */}
      <nav className="border-b border-gray-100 dark:border-gray-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            Real<span className="text-primary-600">Flow</span>
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="/auth"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Sign in
            </Link>
            <a
              href="#calculator"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Check your readiness
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 sm:pb-24 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            <Shield className="h-4 w-4" />
            AUSTRAC Tranche 2 takes effect July 1, 2026
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl lg:text-6xl">
            The only buyer&apos;s agent CRM with built&#8209;in AML/CTF compliance.
          </h1>

          <p className="mt-6 text-lg text-gray-600 dark:text-gray-400">
            AUSTRAC Tranche 2 lands in 3 months. Register as a reporting entity, run KYC on every client,
            monitor transactions, retain records for 7 years. RealFlow handles all of it — inside your CRM,
            next to your pipeline.
          </p>

          <div className="mt-8">
            <WaitlistForm
              source="hero"
              variant={variant}
              referrer={referrer}
              buttonText="Get the free 68-item DD checklist"
              className="mx-auto max-w-lg"
            />
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
              One email. No spam. You get the checklist + early access when we launch.
            </p>
          </div>
        </div>
      </section>

      {/* Problem Block — Where deals fall over */}
      <section className="border-t border-gray-100 bg-gray-50 py-16 dark:border-gray-800 dark:bg-gray-900 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
            Where buyer&apos;s agent deals fall over
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-gray-600 dark:text-gray-400">
            The 90-day window from offer to settlement is where fees are made or lost. These are the preventable misses.
          </p>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <Calendar className="mb-4 h-8 w-8 text-red-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">The date you forgot</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Finance clause on day 14. Cooling-off end on day 5. Pre-settlement inspection 3 days out.
                State-specific. Different per matter. One missed date = negotiation leverage gone.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <Shield className="mb-4 h-8 w-8 text-red-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">The compliance you skipped</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                AUSTRAC 100-point ID on new clients. Tranche 2 obligations. Pool certs. HBCF checks.
                When the regulator asks, &ldquo;show me&rdquo; is not a process.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <Users className="mb-4 h-8 w-8 text-red-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">The client who lost trust</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Your client emails at 9pm: &ldquo;What&apos;s happening?&rdquo; You don&apos;t have a live
                status page to send. The trust you built erodes in the silence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Block */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
            What RealFlow does in that 90-day window
          </h2>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="AUSTRAC-Ready AML/KYC"
              description="100-point ID workflow. Structured records. Export-ready audit trail. 7-year retention. SMR filing. Peace of mind when Tranche 2 lands."
              highlight
            />
            <FeatureCard
              icon={<FileCheck className="h-6 w-6" />}
              title="State-Templated DD"
              description="68 items across NSW / QLD / VIC. Auto-assigned to solicitor, broker, inspector, or client. s66W, Form 1, Section 32 — per-matter, per-state."
            />
            <FeatureCard
              icon={<Activity className="h-6 w-6" />}
              title="Deal Health Score"
              description="Every matter gets a live health score: on-track, at-risk, or critical. Stage-aware. See the deal about to fall over before it does."
            />
            <FeatureCard
              icon={<Calendar className="h-6 w-6" />}
              title="Key Date Tracking"
              description="Cooling-off, finance clause, B&P report, settlement — state-aware deadline chains with alerts before they expire."
            />
            <FeatureCard
              icon={<Users className="h-6 w-6" />}
              title="Client Portal"
              description="Your client sees exactly where their matter is. Without emailing you. At 9pm. Again."
            />
            <FeatureCard
              icon={<Smartphone className="h-6 w-6" />}
              title="Mobile + Web"
              description="Field inspections on your phone, DD management at your desk. Both in sync, both real-time."
            />
          </div>
        </div>
      </section>

      {/* Compliance Calculator */}
      <section id="calculator" className="border-t border-gray-100 bg-gray-50 py-16 dark:border-gray-800 dark:bg-gray-900 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              Are you ready for July 1?
            </h2>
            <ComplianceCalculator variant={variant} referrer={referrer} />
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
            How RealFlow compares
          </h2>
          <div className="mx-auto max-w-3xl">
            <ComparisonTable />
          </div>
        </div>
      </section>

      {/* DD Checklist Lead Magnet */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              The 68-Item AU Buyer&apos;s Agent DD Checklist
            </h2>
            <p className="mt-3 text-gray-600 dark:text-gray-400">
              NSW (22) / QLD (24) / VIC (22). Every item tagged with blocking status,
              risk level, responsible party, and property-type carve-outs. Includes state-specific
              gotchas — s66W, Form 1, Section 32, HBCF, pool certs.
            </p>
            <div className="mt-6">
              <WaitlistForm
                source="dd-checklist"
                variant={variant}
                referrer={referrer}
                buttonText="Send me the checklist"
                className="mx-auto max-w-md"
              />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-gray-100 bg-gray-50 py-16 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900 dark:text-white">
            Common questions
          </h2>
          <div className="space-y-6">
            <FaqItem
              q="I already use BA-ICON / Rex / Agentbox. Is this a replacement?"
              a="RealFlow is a full BA CRM, but our hero feature is compliance and post-match workflow. If your current CRM handles matching well, RealFlow complements it on the deal-management and compliance side."
            />
            <FaqItem
              q="Pricing?"
              a="Public pricing coming Q2 2026. Join the waitlist for founder pricing — locked in before launch."
            />
            <FaqItem
              q="AUSTRAC Tranche 2 — do I actually need to worry?"
              a="Yes. From July 1, 2026, buyer's agents are AUSTRAC reporting entities. You must register, run KYC on every client, file SMRs, and retain records for 7+ years. Penalties for non-compliance are severe."
            />
            <FaqItem
              q="Where are you based?"
              a="Sydney. Built for NSW, QLD, and VIC with state-specific DD templates, compliance workflows, and local integrations."
            />
            <FaqItem
              q="Is this REBAA-endorsed?"
              a="Not yet. We'd love to earn that."
            />
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
            Early access opens Q2 2026
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            Join the waitlist. Get founder pricing locked in. Be compliant before July 1.
          </p>
          <div className="mt-6">
            <WaitlistForm
              source="footer"
              variant={variant}
              referrer={referrer}
              buttonText="Join the waitlist"
              className="mx-auto max-w-md"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 dark:border-gray-800">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-gray-400 dark:text-gray-500">
          <p>RealFlow &mdash; The CRM for Australian buyer&apos;s agents.</p>
          <p className="mt-1">realflow.com.au</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  highlight = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-6 ${
        highlight
          ? 'border-primary-200 bg-primary-50/50 dark:border-primary-800 dark:bg-primary-950/30'
          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
      }`}
    >
      <div className={`mb-3 ${highlight ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'}`}>
        {icon}
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <h3 className="font-semibold text-gray-900 dark:text-white">{q}</h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{a}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <LandingContent />
    </Suspense>
  );
}
