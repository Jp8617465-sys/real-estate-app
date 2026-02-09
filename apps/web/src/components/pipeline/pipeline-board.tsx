'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { BUYER_STAGE_LABELS, type BuyerStage } from '@realflow/shared';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PipelineCard {
  id: string;
  name: string;
  budget: string;
  score: number;
  lastActivity: string;
  stage: string;
}

const initialCards: PipelineCard[] = [
  { id: '1', name: 'Tom Richards', budget: '$600K-$800K', score: 20, lastActivity: '1h ago', stage: 'new-enquiry' },
  { id: '2', name: 'Amy Foster', budget: '$900K-$1.1M', score: 15, lastActivity: '3h ago', stage: 'new-enquiry' },
  { id: '3', name: 'Priya Patel', budget: '$500K-$750K', score: 45, lastActivity: '3d ago', stage: 'qualified-lead' },
  { id: '4', name: 'Michael Johnson', budget: '$800K-$1.2M', score: 82, lastActivity: '2h ago', stage: 'active-search' },
  { id: '5', name: 'Lisa Nguyen', budget: '$1.5M-$2M', score: 90, lastActivity: '1d ago', stage: 'property-shortlisted' },
  { id: '6', name: 'Mark Stevens', budget: '$1.1M', score: 95, lastActivity: '2d ago', stage: 'under-contract' },
];

function ScoreIndicator({ score }: { score: number }) {
  const color =
    score >= 75 ? 'bg-red-500' : score >= 50 ? 'bg-yellow-500' : score >= 25 ? 'bg-blue-500' : 'bg-gray-300';
  return <span className={cn('inline-block h-2 w-2 rounded-full', color)} />;
}

interface CardProps {
  card: PipelineCard;
  isDragging?: boolean;
}

function Card({ card, isDragging = false }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md',
        isDragging && 'opacity-50',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">{card.name}</span>
        <ScoreIndicator score={card.score} />
      </div>
      <p className="mt-1 text-xs text-gray-500">{card.budget}</p>
      <p className="mt-1 text-xs text-gray-400">{card.lastActivity}</p>
    </div>
  );
}

function DraggableCard({ card }: { card: PipelineCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { stage: card.stage },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
      <Card card={card} isDragging={isDragging} />
    </div>
  );
}

interface DroppableColumnProps {
  stage: BuyerStage;
  label: string;
  cards: PipelineCard[];
}

function DroppableColumn({ stage, label, cards }: DroppableColumnProps) {
  const { setNodeRef } = useSortable({
    id: stage,
    data: { type: 'column', stage },
  });

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl border border-gray-200 bg-gray-50">
      {/* Stage header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 rounded-t-xl">
        <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
          {cards.length}
        </span>
      </div>

      {/* Cards */}
      <div ref={setNodeRef} className="flex-1 space-y-2 p-3 min-h-[200px]">
        {cards.length === 0 && <p className="py-4 text-center text-xs text-gray-400">Drop cards here</p>}
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <DraggableCard key={card.id} card={card} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export function PipelineBoard() {
  const [cards, setCards] = useState<PipelineCard[]>(initialCards);
  const [activeCard, setActiveCard] = useState<PipelineCard | null>(null);

  const stages = Object.entries(BUYER_STAGE_LABELS) as [BuyerStage, string][];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const card = cards.find((c) => c.id === active.id);
    if (card) {
      setActiveCard(card);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeCard = cards.find((c) => c.id === activeId);
    if (!activeCard) return;

    // Check if dropped on a column
    const overColumn = stages.find(([key]) => key === overId);
    if (overColumn) {
      const [newStage] = overColumn;
      setCards((prev) =>
        prev.map((card) => (card.id === activeId ? { ...card, stage: newStage } : card)),
      );
      return;
    }

    // Check if dropped on another card
    const overCard = cards.find((c) => c.id === overId);
    if (overCard && activeCard.stage === overCard.stage) {
      // Reorder within same column
      const stageCards = cards.filter((c) => c.stage === activeCard.stage);
      const oldIndex = stageCards.findIndex((c) => c.id === activeId);
      const newIndex = stageCards.findIndex((c) => c.id === overId);

      const reordered = arrayMove(stageCards, oldIndex, newIndex);
      const otherCards = cards.filter((c) => c.stage !== activeCard.stage);
      setCards([...otherCards, ...reordered]);
    } else if (overCard) {
      // Move to different column
      setCards((prev) =>
        prev.map((card) => (card.id === activeId ? { ...card, stage: overCard.stage } : card)),
      );
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        <SortableContext items={stages.map(([key]) => key)}>
          {stages.map(([key, label]) => {
            const stageCards = cards.filter((c) => c.stage === key);
            return <DroppableColumn key={key} stage={key} label={label} cards={stageCards} />;
          })}
        </SortableContext>
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="cursor-grabbing rotate-3 scale-105">
            <Card card={activeCard} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
