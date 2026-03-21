import { EventBus, RealFlowEventType, type Event } from './event-bus';

export abstract class BaseService {
  protected readonly eventBus: EventBus;
  protected readonly serviceName: string;
  private correlationId: string | undefined;

  constructor(serviceName: string, eventBus?: EventBus) {
    this.serviceName = serviceName;
    this.eventBus = eventBus ?? EventBus.getInstance();
  }

  /**
   * Set a correlation ID for the current request context.
   * All events published within this context will share this ID.
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  /**
   * Clear the correlation ID after the request context ends.
   */
  clearCorrelationId(): void {
    this.correlationId = undefined;
  }

  /**
   * Publish an event to the bus with automatic source service and correlation ID.
   */
  protected async publishEvent<T = unknown>(
    type: RealFlowEventType,
    payload: T,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.eventBus.publish(type, payload, {
      correlationId: this.correlationId,
      sourceService: this.serviceName,
      metadata,
    });
  }

  /**
   * Subscribe to events on the bus. Returns an unsubscribe function.
   */
  protected subscribeToEvent<T = unknown>(
    type: RealFlowEventType,
    handler: (event: Event<T>) => Promise<void>
  ): () => boolean {
    const subId = this.eventBus.subscribe(type, handler);
    return () => this.eventBus.unsubscribe(subId);
  }
}
