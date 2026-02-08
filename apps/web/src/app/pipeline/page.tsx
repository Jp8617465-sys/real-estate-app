import { PipelineBoard } from '@/components/pipeline/pipeline-board';

export default function PipelinePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
          <p className="mt-1 text-sm text-gray-500">Track buyers and sellers through each stage</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Seller Pipeline
          </button>
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Buyer Pipeline
          </button>
        </div>
      </div>

      <PipelineBoard />
    </div>
  );
}
