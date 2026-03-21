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
import { BUYER_STAGE_LABELS, type BuyerStage } from '@realflow/shared';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

interface PipelineCard {
  id: string;
  name: string;
  budget: string;
  score: number;
  lastActivity: string;
  stage: BuyerStage;
}

const INITIAL_CARDS: PipelineCard[] = [
  {
    id: '1',
    name: 'Tom Richards',
    budget: '$600K–$800K',
    score: 20,
    lastActivity: '1h ago',
    stage: 'new-enquiry',
  },
  {
    id: '2',
    name: 'Amy Foster',
    budget: '$900K–$1.1M',
    score: 15,
    lastActivity: '3h ago',
    stage: 'new-enquiry',
  },
  {
    id: '3',
    name: 'Priya Patel',
    budget: '$500K–$750K',
    score: 45,
    lastActivity: '3d ago',
    stage: 'qualified-lead',
  },
  {
    id: '4',
    name: 'Michael Johnson',
    budget: '$800K–$1.2M',
    score: 82,
    lastActivity: '2h ago',
    stage: 'active-search',
  },
  {
    id: '5',
    name: 'Lisa Nguyen',
    budget: '$1.5M–$2M',
    score: 90,
    lastActivity: '1d ago',
    stage: 'property-shortlisted',
  },
  {
    id: '6',
    name: 'Mark Stevens',
    budget: '$1.1M',
    score: 95,
    lastActivity: '2d ago',
    stage: 'under-contract',
  },
];

function ScoreIndicator({ score }: { score: number }) {
  const color =
    score >= 75
      ? 'bg-red-500'
      : score >= 50
        ? 'bg-yellow-500'
        : score >= 25
          ? 'bg-blue-500'
          : 'bg-gray-300';
  return <span className={cn('inline-block h-2 w-2 rounded-full', color)} aria-hidden="true" />;
}

function DraggableCard({ card }: { card: PipelineCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

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
      aria-label={`${card.name}, ${card.budget}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900 dark:text-white">{card.name}</span>
        <ScoreIndicator score={card.score} />
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{card.budget}</p>
      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{card.lastActivity}</p>
    </div>
  );
}

function CardOverlay({ card }: { card: PipelineCard }) {
  return (
    <div className="rotate-1 cursor-grabbing rounded-lg border border-brand-300 bg-white p-3 shadow-xl ring-2 ring-brand-400 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900 dark:text-white">{card.name}</span>
        <ScoreIndicator score={card.score} />
      </div>
      <p className="mt-1 text-xs text-gray-500">{card.budget}</p>
    </div>
  );
}

export function PipelineBoard() {
  const [cards, setCards] = useState<PipelineCard[]>(INITIAL_CARDS);
  const [activeCard, setActiveCard] = useState<PipelineCard | null>(null);
  const reduced = useReducedMotion();

  const stages = Object.entries(BUYER_STAGE_LABELS) as [BuyerStage, string][];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveCard(cards.find((c) => c.id === event.active.id) ?? null);
    },
    [cards],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveCard(null);
      if (!over || active.id === over.id) return;

      // Dragged over a column drop zone id = stage key
      const targetStage = stages.find(([key]) => key === String(over.id))?.[0];
      if (targetStage) {
        setCards((prev) =>
          prev.map((c) => (c.id === active.id ? { ...c, stage: targetStage } : c)),
        );
      }
    },
    [stages],
  );

  const cardsByStage = stages.reduce<Record<string, PipelineCard[]>>((acc, [key]) => {
    acc[key] = cards.filter((c) => c.stage === key);
    return acc;
  }, {});

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4" role="region" aria-label="Buyer pipeline">
        {stages.map(([key, label]) => {
          const stageCards = cardsByStage[key] ?? [];
          return (
            <div
              key={key}
              className="flex w-72 shrink-0 flex-col rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50"
            >
              <div className="flex items-center justify-between rounded-t-xl border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{label}</h3>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  {stageCards.length}
                </span>
              </div>

              <SortableContext
                items={stageCards.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div
                  className="min-h-[80px] flex-1 space-y-2 p-3"
                  id={key}
                  aria-label={`${label} column`}
                >
                  {stageCards.length === 0 && (
                    <p className="py-4 text-center text-xs text-gray-400 dark:text-gray-600">
                      No contacts
                    </p>
                  )}
                  <AnimatePresence>
                    {stageCards.map((card) =>
                      reduced ? (
                        <DraggableCard key={card.id} card={card} />
                      ) : (
                        <motion.div
                          key={card.id}
                          layout
                          layoutId={`pipeline-card-${card.id}`}
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
