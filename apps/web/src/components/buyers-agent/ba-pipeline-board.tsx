'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePipelineTransactions, useTransitionStage } from '@/hooks/use-pipeline';
import { useToast } from '@/contexts/toast-context';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { createClient } from '@/lib/supabase/client';
import {
  BUYERS_AGENT_STAGE_LABELS,
  BUYERS_AGENT_STAGE_DESCRIPTIONS,
  type BuyersAgentStage,
} from '@realflow/shared';
import { Skeleton } from '@/components/ui/skeleton';

interface TransactionCard {
  id: string;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    lead_score: number | null;
  } | null;
  property: {
    id: string;
    address_street_number: string | null;
    address_street_name: string | null;
    address_suburb: string | null;
  } | null;
  current_stage: string;
  updated_at: string;
}

function StageTooltip({ description }: { description: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="flex h-5 w-5 items-center justify-center rounded-full text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
        aria-label="Stage description"
        aria-describedby={show ? 'stage-tooltip' : undefined}
      >
        ?
      </button>
      {show && (
        <div
          id="stage-tooltip"
          role="tooltip"
          className="absolute left-1/2 top-full z-10 mt-1 w-56 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          {description}
        </div>
      )}
    </div>
  );
}

function ScoreIndicator({ score }: { score: number }) {
  const color =
    score >= 75 ? 'bg-red-500' : score >= 50 ? 'bg-yellow-500' : score >= 25 ? 'bg-blue-500' : 'bg-gray-300';
  return <span className={cn('inline-block h-2 w-2 rounded-full', color)} aria-hidden="true" />;
}

function DraggableCard({ card }: { card: TransactionCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const contactName = card.contact
    ? `${card.contact.first_name} ${card.contact.last_name}`
    : 'Unknown';
  const propertyAddress = card.property
    ? `${card.property.address_street_number ?? ''} ${card.property.address_street_name ?? ''}, ${card.property.address_suburb ?? ''}`.trim()
    : null;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow',
        'dark:border-gray-700 dark:bg-gray-800',
        isDragging ? 'opacity-40 shadow-none' : 'hover:shadow-md',
      )}
      aria-label={`${contactName}${propertyAddress ? `, ${propertyAddress}` : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900 dark:text-white">{contactName}</span>
        {card.contact?.lead_score != null && (
          <ScoreIndicator score={card.contact.lead_score} />
        )}
      </div>
      {propertyAddress && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{propertyAddress}</p>
      )}
    </div>
  );
}

function CardOverlay({ card }: { card: TransactionCard }) {
  const contactName = card.contact
    ? `${card.contact.first_name} ${card.contact.last_name}`
    : 'Unknown';
  return (
    <div className="rotate-1 cursor-grabbing rounded-lg border border-brand-300 bg-white p-3 shadow-xl ring-2 ring-brand-400 dark:bg-gray-800">
      <span className="text-sm font-medium text-gray-900 dark:text-white">{contactName}</span>
    </div>
  );
}

function LoadingSkeleton({ stageCount }: { stageCount: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: stageCount }).map((_, i) => (
        <div key={i} className="w-72 shrink-0 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
          <Skeleton className="mb-4 h-4 w-32" />
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BaPipelineBoard() {
  const { data: transactions, isLoading } = usePipelineTransactions('buyers-agent');
  const { mutateAsync: transitionStage } = useTransitionStage();
  const { toast } = useToast();
  const reduced = useReducedMotion();

  const [activeCard, setActiveCard] = useState<TransactionCard | null>(null);
  // Optimistic stage overrides: transactionId → stageName
  const [optimisticStages, setOptimisticStages] = useState<Record<string, string>>({});

  const stages = Object.entries(BUYERS_AGENT_STAGE_LABELS) as [BuyersAgentStage, string][];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Build cards with optimistic overrides applied
  const cardsByStage: Record<string, TransactionCard[]> = {};
  for (const [key] of stages) cardsByStage[key] = [];

  if (transactions) {
    for (const txn of transactions) {
      const stage = optimisticStages[txn.id] ?? txn.current_stage;
      if (cardsByStage[stage]) {
        cardsByStage[stage].push({ ...txn, current_stage: stage } as TransactionCard);
      }
    }
  }

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const card = Object.values(cardsByStage)
        .flat()
        .find((c) => c.id === event.active.id);
      setActiveCard(card ?? null);
    },
    [transactions, optimisticStages],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveCard(null);
      if (!over || active.id === over.id) return;

      const targetStage = stages.find(([key]) => key === String(over.id))?.[0];
      if (!targetStage) return;

      const sourceCard = Object.values(cardsByStage)
        .flat()
        .find((c) => c.id === active.id);
      if (!sourceCard || sourceCard.current_stage === targetStage) return;

      const fromStage = sourceCard.current_stage;
      const transactionId = sourceCard.id;

      // Optimistic update
      setOptimisticStages((prev) => ({ ...prev, [transactionId]: targetStage }));

      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id ?? 'system';

        await transitionStage({ transactionId, fromStage, toStage: targetStage, pipelineType: 'buyers-agent', userId });

        // Clear optimistic override (server data will reflect via query invalidation)
        setOptimisticStages((prev) => {
          const next = { ...prev };
          delete next[transactionId];
          return next;
        });

        toast({ message: `Moved to ${BUYERS_AGENT_STAGE_LABELS[targetStage as BuyersAgentStage]}`, variant: 'success' });
      } catch (err) {
        // Rollback optimistic update
        setOptimisticStages((prev) => {
          const next = { ...prev };
          delete next[transactionId];
          return next;
        });
        const message = err instanceof Error ? err.message : 'Could not move card';
        toast({ message, variant: 'error' });
      }
    },
    [stages, cardsByStage, transitionStage, toast],
  );

  if (isLoading) {
    return <LoadingSkeleton stageCount={stages.length} />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4" role="region" aria-label="Buyers agent pipeline">
        {stages.map(([key, label]) => {
          const cards = cardsByStage[key] ?? [];
          const description = BUYERS_AGENT_STAGE_DESCRIPTIONS[key];
          return (
            <div
              key={key}
              className="flex w-72 shrink-0 flex-col rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50"
            >
              <div className="flex items-center justify-between rounded-t-xl border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{label}</h3>
                  <StageTooltip description={description} />
                </div>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  {cards.length}
                </span>
              </div>

              <SortableContext
                items={cards.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div
                  className="min-h-[80px] flex-1 space-y-2 p-3"
                  id={key}
                  aria-label={`${label} column`}
                >
                  {cards.length === 0 && (
                    <p className="py-4 text-center text-xs text-gray-400 dark:text-gray-600">
                      No clients
                    </p>
                  )}
                  <AnimatePresence>
                    {cards.map((card) =>
                      reduced ? (
                        <DraggableCard key={card.id} card={card} />
                      ) : (
                        <motion.div
                          key={card.id}
                          layout
                          layoutId={`ba-card-${card.id}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.16, ease: 'easeOut' }}
                        >
                          <DraggableCard card={card} />
                        </motion.div>
                      ),
                    )}
                  </AnimatePresence>
                </div>
              </SortableContext>
            </div>
          );
        })}
      </div>
      <DragOverlay>{activeCard ? <CardOverlay card={activeCard} /> : null}</DragOverlay>
    </DndContext>
  );
}
