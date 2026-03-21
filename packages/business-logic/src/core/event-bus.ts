// ─── Event Types ─────────────────────────────────────────────────────
export enum RealFlowEventType {
  // Lead/Contact events
  LEAD_CREATED = 'lead.created',
  LEAD_SCORED = 'lead.scored',
  LEAD_QUALIFIED = 'lead.qualified',
  CONTACT_MERGED = 'contact.merged',
  DUPLICATE_DETECTED = 'contact.duplicate_detected',

  // Pipeline events
  DEAL_STAGE_CHANGED = 'deal.stage_changed',
  DEAL_WON = 'deal.won',
  DEAL_LOST = 'deal.lost',
  OFFER_SUBMITTED = 'offer.submitted',
  OFFER_ACCEPTED = 'offer.accepted',

  // Property events
  PROPERTY_MATCHED = 'property.matched',
  PROPERTY_ALERT_TRIGGERED = 'property.alert_triggered',
  LISTING_SYNCED = 'listing.synced',
  PRICE_CHANGED = 'property.price_changed',

  // Brief events (BA)
  BRIEF_CREATED = 'brief.created',
  BRIEF_UPDATED = 'brief.updated',
  BRIEF_MATCH_FOUND = 'brief.match_found',

  // Communication events
  MESSAGE_RECEIVED = 'message.received',
  MESSAGE_SENT = 'message.sent',

  // Workflow events
  WORKFLOW_TRIGGERED = 'workflow.triggered',
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED = 'workflow.failed',

  // Task events
  TASK_CREATED = 'task.created',
  TASK_COMPLETED = 'task.completed',
  TASK_OVERDUE = 'task.overdue',

  // Compliance events
  COMPLIANCE_CHECK_REQUIRED = 'compliance.check_required',
  COMPLIANCE_FLAGGED = 'compliance.flagged',
  AML_VERIFIED = 'compliance.aml_verified',

  // Notification events
  NOTIFICATION_SENT = 'notification.sent',
  NOTIFICATION_FAILED = 'notification.failed',

  // AI events
  AI_ASSISTANT_QUERY = 'ai.assistant_query',
  AI_LEAD_SCORED = 'ai.lead_scored',
  AI_PROPERTY_MATCHED = 'ai.property_matched',

  // Subscription events
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPGRADED = 'subscription.upgraded',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  PAYMENT_FAILED = 'subscription.payment_failed',
}

// ─── Event Interface ─────────────────────────────────────────────────
export interface Event<T = unknown> {
  id: string;
  type: RealFlowEventType;
  payload: T;
  timestamp: Date;
  correlationId: string;
  sourceService: string;
  metadata?: Record<string, unknown>;
}

// ─── Event Handler ───────────────────────────────────────────────────
export type EventHandler<T = unknown> = (event: Event<T>) => Promise<void>;

interface Subscription {
  id: string;
  type: RealFlowEventType;
  handler: EventHandler;
}

// ─── Ring Buffer ─────────────────────────────────────────────────────
class RingBuffer<T> {
  private buffer: T[];
  private head: number = 0;
  private count: number = 0;

  constructor(private readonly capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  toArray(): T[] {
    if (this.count === 0) return [];
    if (this.count < this.capacity) {
      return this.buffer.slice(0, this.count);
    }
    // Buffer is full — return in chronological order
    return [
      ...this.buffer.slice(this.head),
      ...this.buffer.slice(0, this.head),
    ];
  }

  get size(): number {
    return this.count;
  }

  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.count = 0;
  }
}

// ─── Event Bus ───────────────────────────────────────────────────────
let nextSubscriptionId = 0;

export class EventBus {
  private subscriptions: Map<RealFlowEventType, Subscription[]> = new Map();
  private history: RingBuffer<Event>;
  private static instance: EventBus | null = null;

  constructor(historyCapacity: number = 1000) {
    this.history = new RingBuffer(historyCapacity);
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  static resetInstance(): void {
    EventBus.instance = null;
  }

  subscribe<T = unknown>(
    type: RealFlowEventType,
    handler: EventHandler<T>
  ): string {
    const id = `sub_${++nextSubscriptionId}`;
    const subscription: Subscription = {
      id,
      type,
      handler: handler as EventHandler,
    };

    const existing = this.subscriptions.get(type) ?? [];
    existing.push(subscription);
    this.subscriptions.set(type, existing);

    return id;
  }

  unsubscribe(subscriptionId: string): boolean {
    for (const [type, subs] of this.subscriptions.entries()) {
      const index = subs.findIndex((s) => s.id === subscriptionId);
      if (index !== -1) {
        subs.splice(index, 1);
        if (subs.length === 0) {
          this.subscriptions.delete(type);
        }
        return true;
      }
    }
    return false;
  }

  async publish<T = unknown>(
    type: RealFlowEventType,
    payload: T,
    options?: {
      correlationId?: string;
      sourceService?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    const event: Event<T> = {
      id: crypto.randomUUID(),
      type,
      payload,
      timestamp: new Date(),
      correlationId: options?.correlationId ?? crypto.randomUUID(),
      sourceService: options?.sourceService ?? 'unknown',
      metadata: options?.metadata,
    };

    this.history.push(event as Event);

    const handlers = this.subscriptions.get(type) ?? [];

    // Fire all handlers concurrently — don't block the publisher
    const results = await Promise.allSettled(
      handlers.map((sub) => sub.handler(event as Event))
    );

    // Log failures but don't throw — publishers should not break on handler errors
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error(
          `[EventBus] Handler failed for ${type}:`,
          result.reason
        );
      }
    }
  }

  getHistory(filter?: {
    type?: RealFlowEventType;
    correlationId?: string;
    limit?: number;
  }): Event[] {
    let events = this.history.toArray();

    if (filter?.type) {
      events = events.filter((e) => e.type === filter.type);
    }
    if (filter?.correlationId) {
      events = events.filter((e) => e.correlationId === filter.correlationId);
    }
    if (filter?.limit) {
      events = events.slice(-filter.limit);
    }

    return events;
  }

  getSubscriptionCount(type?: RealFlowEventType): number {
    if (type) {
      return this.subscriptions.get(type)?.length ?? 0;
    }
    let total = 0;
    for (const subs of this.subscriptions.values()) {
      total += subs.length;
    }
    return total;
  }

  clearHistory(): void {
    this.history.clear();
  }

  removeAllSubscriptions(): void {
    this.subscriptions.clear();
  }
}

// ─── Singleton Export ────────────────────────────────────────────────
export const eventBus = EventBus.getInstance();
