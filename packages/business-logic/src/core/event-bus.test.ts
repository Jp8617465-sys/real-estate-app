import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus, RealFlowEventType, type Event } from './event-bus';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    EventBus.resetInstance();
    bus = new EventBus();
  });

  describe('singleton', () => {
    it('returns the same instance from getInstance()', () => {
      const a = EventBus.getInstance();
      const b = EventBus.getInstance();
      expect(a).toBe(b);
    });

    it('creates a new instance after resetInstance()', () => {
      const a = EventBus.getInstance();
      EventBus.resetInstance();
      const b = EventBus.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('subscribe / publish', () => {
    it('delivers event to subscribed handler', async () => {
      const handler = vi.fn<(event: Event<{ name: string }>) => Promise<void>>().mockResolvedValue(undefined);
      bus.subscribe(RealFlowEventType.LEAD_CREATED, handler);

      await bus.publish(RealFlowEventType.LEAD_CREATED, { name: 'Alice' });

      expect(handler).toHaveBeenCalledOnce();
      const event = handler.mock.calls[0][0];
      expect(event.type).toBe(RealFlowEventType.LEAD_CREATED);
      expect(event.payload).toEqual({ name: 'Alice' });
      expect(event.id).toBeTruthy();
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.correlationId).toBeTruthy();
    });

    it('does not deliver events of a different type', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      bus.subscribe(RealFlowEventType.LEAD_CREATED, handler);

      await bus.publish(RealFlowEventType.DEAL_WON, { dealId: '123' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('delivers to multiple handlers for the same event type', async () => {
      const h1 = vi.fn().mockResolvedValue(undefined);
      const h2 = vi.fn().mockResolvedValue(undefined);
      bus.subscribe(RealFlowEventType.DEAL_STAGE_CHANGED, h1);
      bus.subscribe(RealFlowEventType.DEAL_STAGE_CHANGED, h2);

      await bus.publish(RealFlowEventType.DEAL_STAGE_CHANGED, { stage: 'negotiation' });

      expect(h1).toHaveBeenCalledOnce();
      expect(h2).toHaveBeenCalledOnce();
    });

    it('propagates correlationId when provided', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      bus.subscribe(RealFlowEventType.TASK_CREATED, handler);

      await bus.publish(RealFlowEventType.TASK_CREATED, {}, {
        correlationId: 'req-abc-123',
      });

      expect(handler.mock.calls[0][0].correlationId).toBe('req-abc-123');
    });

    it('sets sourceService when provided', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      bus.subscribe(RealFlowEventType.MESSAGE_SENT, handler);

      await bus.publish(RealFlowEventType.MESSAGE_SENT, {}, {
        sourceService: 'inbox-service',
      });

      expect(handler.mock.calls[0][0].sourceService).toBe('inbox-service');
    });

    it('includes metadata when provided', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      bus.subscribe(RealFlowEventType.LISTING_SYNCED, handler);

      await bus.publish(RealFlowEventType.LISTING_SYNCED, {}, {
        metadata: { portalId: 'domain-123' },
      });

      expect(handler.mock.calls[0][0].metadata).toEqual({ portalId: 'domain-123' });
    });
  });

  describe('unsubscribe', () => {
    it('removes handler so it stops receiving events', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const subId = bus.subscribe(RealFlowEventType.LEAD_SCORED, handler);

      await bus.publish(RealFlowEventType.LEAD_SCORED, { score: 80 });
      expect(handler).toHaveBeenCalledOnce();

      bus.unsubscribe(subId);
      await bus.publish(RealFlowEventType.LEAD_SCORED, { score: 90 });
      expect(handler).toHaveBeenCalledOnce(); // still 1, not 2
    });

    it('returns true when subscription is found', () => {
      const subId = bus.subscribe(RealFlowEventType.DEAL_WON, vi.fn().mockResolvedValue(undefined));
      expect(bus.unsubscribe(subId)).toBe(true);
    });

    it('returns false for unknown subscription', () => {
      expect(bus.unsubscribe('sub_nonexistent')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('does not throw when a handler fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failHandler = vi.fn().mockRejectedValue(new Error('handler boom'));
      const successHandler = vi.fn().mockResolvedValue(undefined);

      bus.subscribe(RealFlowEventType.WORKFLOW_FAILED, failHandler);
      bus.subscribe(RealFlowEventType.WORKFLOW_FAILED, successHandler);

      // Should not throw
      await bus.publish(RealFlowEventType.WORKFLOW_FAILED, { reason: 'timeout' });

      expect(failHandler).toHaveBeenCalledOnce();
      expect(successHandler).toHaveBeenCalledOnce();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Handler failed'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('history', () => {
    it('records published events', async () => {
      await bus.publish(RealFlowEventType.LEAD_CREATED, { name: 'Bob' });
      await bus.publish(RealFlowEventType.DEAL_WON, { value: 500000 });

      const history = bus.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].type).toBe(RealFlowEventType.LEAD_CREATED);
      expect(history[1].type).toBe(RealFlowEventType.DEAL_WON);
    });

    it('filters by event type', async () => {
      await bus.publish(RealFlowEventType.LEAD_CREATED, {});
      await bus.publish(RealFlowEventType.DEAL_WON, {});
      await bus.publish(RealFlowEventType.LEAD_CREATED, {});

      const filtered = bus.getHistory({ type: RealFlowEventType.LEAD_CREATED });
      expect(filtered).toHaveLength(2);
    });

    it('filters by correlationId', async () => {
      await bus.publish(RealFlowEventType.TASK_CREATED, {}, { correlationId: 'corr-1' });
      await bus.publish(RealFlowEventType.TASK_COMPLETED, {}, { correlationId: 'corr-1' });
      await bus.publish(RealFlowEventType.TASK_CREATED, {}, { correlationId: 'corr-2' });

      const filtered = bus.getHistory({ correlationId: 'corr-1' });
      expect(filtered).toHaveLength(2);
    });

    it('respects limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await bus.publish(RealFlowEventType.LEAD_CREATED, { i });
      }

      const limited = bus.getHistory({ limit: 3 });
      expect(limited).toHaveLength(3);
      // Should be the last 3
      expect(limited[0].payload).toEqual({ i: 7 });
      expect(limited[2].payload).toEqual({ i: 9 });
    });

    it('respects ring buffer capacity', async () => {
      const smallBus = new EventBus(5);

      for (let i = 0; i < 10; i++) {
        await smallBus.publish(RealFlowEventType.LEAD_CREATED, { i });
      }

      const history = smallBus.getHistory();
      expect(history).toHaveLength(5);
      // Should keep the last 5 (indices 5-9)
      expect(history[0].payload).toEqual({ i: 5 });
      expect(history[4].payload).toEqual({ i: 9 });
    });

    it('clears history', async () => {
      await bus.publish(RealFlowEventType.LEAD_CREATED, {});
      expect(bus.getHistory()).toHaveLength(1);

      bus.clearHistory();
      expect(bus.getHistory()).toHaveLength(0);
    });
  });

  describe('getSubscriptionCount', () => {
    it('returns count for a specific event type', () => {
      bus.subscribe(RealFlowEventType.DEAL_WON, vi.fn().mockResolvedValue(undefined));
      bus.subscribe(RealFlowEventType.DEAL_WON, vi.fn().mockResolvedValue(undefined));
      bus.subscribe(RealFlowEventType.DEAL_LOST, vi.fn().mockResolvedValue(undefined));

      expect(bus.getSubscriptionCount(RealFlowEventType.DEAL_WON)).toBe(2);
      expect(bus.getSubscriptionCount(RealFlowEventType.DEAL_LOST)).toBe(1);
      expect(bus.getSubscriptionCount(RealFlowEventType.LEAD_CREATED)).toBe(0);
    });

    it('returns total count when no type specified', () => {
      bus.subscribe(RealFlowEventType.DEAL_WON, vi.fn().mockResolvedValue(undefined));
      bus.subscribe(RealFlowEventType.DEAL_LOST, vi.fn().mockResolvedValue(undefined));

      expect(bus.getSubscriptionCount()).toBe(2);
    });
  });

  describe('removeAllSubscriptions', () => {
    it('removes all subscriptions', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      bus.subscribe(RealFlowEventType.LEAD_CREATED, handler);
      bus.subscribe(RealFlowEventType.DEAL_WON, handler);

      bus.removeAllSubscriptions();

      await bus.publish(RealFlowEventType.LEAD_CREATED, {});
      await bus.publish(RealFlowEventType.DEAL_WON, {});
      expect(handler).not.toHaveBeenCalled();
      expect(bus.getSubscriptionCount()).toBe(0);
    });
  });
});
