import { Check, Minus } from 'lucide-react';

interface Feature {
  name: string;
  highlight?: boolean;
  baIcon: boolean | 'partial';
  openBa: boolean | 'partial';
  realflow: boolean | 'partial';
}

const FEATURES: Feature[] = [
  { name: 'BA-specific CRM', baIcon: true, openBa: false, realflow: true },
  { name: 'Property intelligence', baIcon: true, openBa: false, realflow: true },
  { name: 'AI agent outreach', baIcon: false, openBa: true, realflow: true },
  { name: 'AML/CTF Tranche 2 compliance', highlight: true, baIcon: false, openBa: false, realflow: true },
  { name: 'State-specific DD (NSW/QLD/VIC)', baIcon: 'partial', openBa: false, realflow: true },
  { name: 'AI deal-health scoring', baIcon: false, openBa: false, realflow: true },
  { name: 'Client portal', baIcon: true, openBa: false, realflow: true },
  { name: 'Mobile app', baIcon: false, openBa: false, realflow: true },
];

function Cell({ value }: { value: boolean | 'partial' }) {
  if (value === true) return <Check className="mx-auto h-5 w-5 text-green-600 dark:text-green-400" />;
  if (value === 'partial') return <span className="text-xs text-yellow-600 dark:text-yellow-400">Partial</span>;
  return <Minus className="mx-auto h-5 w-5 text-gray-300 dark:text-gray-600" />;
}

export function ComparisonTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="py-3 pr-4 text-left font-medium text-gray-500 dark:text-gray-400">Feature</th>
            <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">BA-ICON + Stash</th>
            <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Open BA</th>
            <th className="px-4 py-3 text-center font-semibold text-primary-600 dark:text-primary-400">RealFlow</th>
          </tr>
        </thead>
        <tbody>
          {FEATURES.map((f) => (
            <tr
              key={f.name}
              className={`border-b border-gray-100 dark:border-gray-800 ${f.highlight ? 'bg-primary-50/50 dark:bg-primary-950/30' : ''}`}
            >
              <td className={`py-3 pr-4 text-gray-700 dark:text-gray-300 ${f.highlight ? 'font-semibold' : ''}`}>
                {f.name}
              </td>
              <td className="px-4 py-3 text-center"><Cell value={f.baIcon} /></td>
              <td className="px-4 py-3 text-center"><Cell value={f.openBa} /></td>
              <td className="px-4 py-3 text-center"><Cell value={f.realflow} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
        BA-ICON does pipelines well. Stash does data well. Open BA does outreach well.
        <br />
        We do all three — and we&apos;re the only ones who&apos;ll keep you compliant from July 1.
      </p>
    </div>
  );
}
