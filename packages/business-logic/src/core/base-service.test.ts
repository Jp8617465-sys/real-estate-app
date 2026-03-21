import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseService } from './base-service';
import { EventBus, RealFlowEventType } from './event-bus';

class TestService extends BaseService {
  constructor(eventBus?: EventBus) {
    super('test-service', eventBus);
  }

  async doWork(payload: Record<string, unknown>): Promise<void> {
    await this.publishEvent(RealFlowEventType.TASK_CREATED, payload);
  }

  async doWorkWithMeta(payload: Record<string, unknown>): Promise<void> {
    await this.publishEvent(RealFlowEventType.TASK_CREATED, payload, {
      triggeredBy: 'unit-test',
    });
  }

  listenForTasks(handler: (event: unknown) => Promise<void>): () => boolean {
    return this.subscribeToEvent(RealFlowEventType.TASK_COMPLETED, handler);
  }
}

describe('BaseService', () => {
  let bus: EventBus;
  let service: TestService;

  beforeEach(() => {
    EventBus.resetInstance();
    bus = new EventBus();
    service = new TestService(bus);
  });

  it('publishes events with the service name as source', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    bus.subscribe(RealFlowEventType.TASK_CREATED, handler);

    await service.doWork({ taskName: 'Follow up' });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].sourceService).toBe('test-service');
    expect(handler.mock.calls[0][0].payload).toEqual({ taskName: 'Follow up' });
  });

  it('propagates correlation ID when set', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    bus.subscribe(RealFlowEventType.TASK_CREATED, handler);

    service.setCorrelationId('request-xyz');
    await service.doWork({ taskName: 'Call vendor' });

    expect(handler.mock.calls[0][0].correlationId).toBe('request-xyz');
  });

  it('clears correlation ID', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    bus.subscribe(RealFlowEventType.TASK_CREATED, handler);

    service.setCorrelationId('request-xyz');
    service.clearCorrelationId();
    await service.doWork({});

    // Should have a generated UUID, not 'request-xyz'
    expect(handler.mock.calls[0][0].correlationId).not.toBe('request-xyz');
    expect(handler.mock.calls[0][0].correlationId).toBeTruthy();
  });

  it('includes metadata when provided', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    bus.subscribe(RealFlowEventType.TASK_CREATED, handler);

    await service.doWorkWithMeta({ taskName: 'Prepare contract' });

    expect(handler.mock.calls[0][0].metadata).toEqual({ triggeredBy: 'unit-test' });
  });

  it('subscribes to events and can unsubscribe', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const unsubscribe = service.listenForTasks(handler);

    await bus.publish(RealFlowEventType.TASK_COMPLETED, { done: true });
    expect(handler).toHaveBeenCalledOnce();

    unsubscribe();
    await bus.publish(RealFlowEventType.TASK_COMPLETED, { done: true });
    expect(handler).toHaveBeenCalledOnce(); // still 1
  });
});
