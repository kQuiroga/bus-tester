import { queueColorIndex } from './queue-color';

/**
 * `queueColorIndex` is the deterministic queue-name → palette-slot mapping behind the
 * tinted queue pill and dot (ui-presentation: "Queues Are Identified by a Tinted Pill
 * and Dot"; design D5 — FNV-1a 32-bit folded into six token slots).
 */
describe('queueColorIndex', () => {
  it('always returns an integer in the 1..6 palette range', () => {
    const names = [
      'orders',
      'orders.created',
      'shipping-queue',
      'payments',
      'inventory',
      'dead-letter',
      'q1',
      'q2',
      'q3',
      '',
      'a',
      'a-very-long-queue-name-with.dots.and-dashes-1234567890',
    ];

    for (const name of names) {
      const index = queueColorIndex(name);
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(1);
      expect(index).toBeLessThanOrEqual(6);
    }
  });

  it('is deterministic — repeated calls for one name return the identical slot', () => {
    const first = queueColorIndex('orders-queue');

    for (let i = 0; i < 50; i++) {
      expect(queueColorIndex('orders-queue')).toBe(first);
    }
  });

  it('is stable across a resubscribe — the same queue name always resolves to the same slot', () => {
    // Simulates unsubscribe + resubscribe: the name is all the function ever sees, so
    // there is no insertion-order drift (design D5 rejected subscription-index colouring).
    const beforeUnsubscribe = queueColorIndex('audit-log');
    const afterResubscribe = queueColorIndex('audit-log');

    expect(afterResubscribe).toBe(beforeUnsubscribe);
  });

  it('matches the reference FNV-1a values for known queue names', () => {
    // Reference values computed from the spec algorithm:
    //   h = 0x811c9dc5; for each UTF-16 code unit: h ^= c; h = Math.imul(h, 0x01000193);
    //   return ((h >>> 0) % 6) + 1
    expect(queueColorIndex('orders')).toBe(3);
    expect(queueColorIndex('payments')).toBe(1);
    expect(queueColorIndex('shipping-queue')).toBe(4);
    expect(queueColorIndex('orders-queue')).toBe(5);
    expect(queueColorIndex('orders.created')).toBe(5);
    expect(queueColorIndex('orders.updated')).toBe(6);
  });

  it('spreads a realistic queue set across all six palette slots', () => {
    const names = ['payments', 'q3', 'q2', 'shipping-queue', 'a', 'shipping'];

    const slots = new Set(names.map(queueColorIndex));

    expect([...slots].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('keeps the multiply in int32 (Math.imul) for very long names — no float drift out of range', () => {
    // A plain `h * 0x01000193` loses integer precision past 2^53 and would push the
    // result outside 1..6 (or to a non-integer). Math.imul keeps every step in int32.
    const long = 'a'.repeat(5000);

    expect(queueColorIndex(long)).toBe(2);

    const prefixed = 'queue-' + 'x'.repeat(2000);
    expect(queueColorIndex(prefixed)).toBe(6);
  });
});
