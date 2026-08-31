import { TestBed } from '@angular/core/testing';
import { SendHistoryService } from './send-history.service';

const RECENT_SENDS_KEY = 'send-panel.recent-sends';
const TEMPLATES_KEY = 'send-panel.templates';

describe('SendHistoryService', () => {
  let service: SendHistoryService;

  beforeEach(() => {
    localStorage.removeItem(RECENT_SENDS_KEY);
    localStorage.removeItem(TEMPLATES_KEY);
    TestBed.configureTestingModule({});
    service = TestBed.inject(SendHistoryService);
  });

  afterEach(() => {
    localStorage.removeItem(RECENT_SENDS_KEY);
    localStorage.removeItem(TEMPLATES_KEY);
  });

  it('starts with empty recentSends and templates when localStorage is empty', () => {
    expect(service.recentSends()).toEqual([]);
    expect(service.templates()).toEqual([]);
  });

  it('recordSend adds the new entry first (newest-first)', () => {
    service.recordSend({ exchange: 'orders', routingKey: 'orders.created', payload: '{"id":1}' });
    service.recordSend({ exchange: 'orders', routingKey: 'orders.updated', payload: '{"id":2}' });

    const sends = service.recentSends();

    expect(sends.length).toBe(2);
    expect(sends[0].routingKey).toBe('orders.updated');
    expect(sends[1].routingKey).toBe('orders.created');
  });

  it('recordSend caps the list at 5 entries, evicting the oldest (FIFO)', () => {
    for (let i = 0; i < 6; i++) {
      service.recordSend({ exchange: 'orders', routingKey: `orders.${i}`, payload: `{"id":${i}}` });
    }

    const sends = service.recentSends();

    expect(sends.length).toBe(5);
    expect(sends[0].routingKey).toBe('orders.5');
    expect(sends[sends.length - 1].routingKey).toBe('orders.1');
  });

  it('clearRecentSends empties the in-memory list AND removes the persisted localStorage key', () => {
    service.recordSend({ exchange: 'orders', routingKey: 'orders.created', payload: '{"id":1}' });
    expect(service.recentSends().length).toBe(1);
    expect(localStorage.getItem(RECENT_SENDS_KEY)).not.toBeNull();

    service.clearRecentSends();

    expect(service.recentSends()).toEqual([]);
    expect(localStorage.getItem(RECENT_SENDS_KEY)).toBeNull();
  });

  it('clearRecentSends keeps the list empty after a reload (fresh service instance)', () => {
    service.recordSend({ exchange: 'orders', routingKey: 'orders.created', payload: '{"id":1}' });
    service.clearRecentSends();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});

    expect(TestBed.inject(SendHistoryService).recentSends()).toEqual([]);
  });

  it('truncates a persisted list longer than 5 to the 5 most recent AND rewrites the key on first load', () => {
    const oversized = Array.from({ length: 8 }, (_, i) => ({
      exchange: 'orders',
      routingKey: `orders.${i}`,
      payload: `{"id":${i}}`,
      sentAt: `2026-01-0${i + 1}T00:00:00.000Z`,
    }));
    localStorage.setItem(RECENT_SENDS_KEY, JSON.stringify(oversized));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const reloaded = TestBed.inject(SendHistoryService);

    expect(reloaded.recentSends().map((s) => s.routingKey)).toEqual([
      'orders.0',
      'orders.1',
      'orders.2',
      'orders.3',
      'orders.4',
    ]);
    const persisted = JSON.parse(localStorage.getItem(RECENT_SENDS_KEY) as string) as Array<{ routingKey: string }>;
    expect(persisted.map((s) => s.routingKey)).toEqual(['orders.0', 'orders.1', 'orders.2', 'orders.3', 'orders.4']);
  });

  it('leaves a persisted list of 5 or fewer entries untouched on load', () => {
    const five = Array.from({ length: 5 }, (_, i) => ({
      exchange: 'orders',
      routingKey: `orders.${i}`,
      payload: `{"id":${i}}`,
      sentAt: `2026-01-0${i + 1}T00:00:00.000Z`,
    }));
    localStorage.setItem(RECENT_SENDS_KEY, JSON.stringify(five));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const reloaded = TestBed.inject(SendHistoryService);

    expect(reloaded.recentSends()).toHaveLength(5);
    expect(JSON.parse(localStorage.getItem(RECENT_SENDS_KEY) as string)).toHaveLength(5);
  });

  it('saveTemplate dedupes by name, overwriting the existing entry', () => {
    service.saveTemplate({ name: 'my-template', exchange: 'orders', routingKey: 'a', payload: 'p1' });
    service.saveTemplate({ name: 'my-template', exchange: 'orders', routingKey: 'b', payload: 'p2' });

    const templates = service.templates();

    expect(templates.length).toBe(1);
    expect(templates[0]).toEqual({ name: 'my-template', exchange: 'orders', routingKey: 'b', payload: 'p2' });
  });

  it('deleteTemplate removes the entry with the matching name', () => {
    service.saveTemplate({ name: 'keep-me', exchange: 'orders', routingKey: 'a', payload: 'p1' });
    service.saveTemplate({ name: 'remove-me', exchange: 'orders', routingKey: 'b', payload: 'p2' });

    service.deleteTemplate('remove-me');

    const templates = service.templates();

    expect(templates.length).toBe(1);
    expect(templates[0].name).toBe('keep-me');
  });

  it('falls back to an empty recentSends list without throwing when its localStorage entry is corrupted JSON', () => {
    localStorage.setItem(RECENT_SENDS_KEY, 'not-json{');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});

    expect(() => TestBed.inject(SendHistoryService)).not.toThrow();
    expect(TestBed.inject(SendHistoryService).recentSends()).toEqual([]);
  });

  it('falls back to an empty templates list when its localStorage entry is valid JSON but not an array', () => {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify({ not: 'an-array' }));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});

    expect(TestBed.inject(SendHistoryService).templates()).toEqual([]);
  });

  it('recordSend persists an optional headers map, readable back from recentSends', () => {
    service.recordSend({
      exchange: 'orders',
      routingKey: 'orders.created',
      payload: '{"id":1}',
      headers: { 'NServiceBus.ContentType': 'application/json' },
    });

    expect(service.recentSends()[0].headers).toEqual({ 'NServiceBus.ContentType': 'application/json' });
  });

  it('saveTemplate persists an optional headers map, readable back from templates', () => {
    service.saveTemplate({
      name: 'my-template',
      exchange: 'orders',
      routingKey: 'a',
      payload: 'p',
      headers: { 'X-Custom': 'abc' },
    });

    expect(service.templates()[0].headers).toEqual({ 'X-Custom': 'abc' });
  });

  it('recordSend/saveTemplate entries without a headers field stay undefined, no error thrown', () => {
    expect(() => service.recordSend({ exchange: 'orders', routingKey: 'a', payload: 'p' })).not.toThrow();
    expect(() => service.saveTemplate({ name: 't', exchange: 'orders', routingKey: 'a', payload: 'p' })).not.toThrow();

    expect(service.recentSends()[0].headers).toBeUndefined();
    expect(service.templates()[0].headers).toBeUndefined();
  });

  it('recent sends and templates survive a reload (fresh service instance reads from localStorage)', () => {
    service.recordSend({ exchange: 'orders', routingKey: 'orders.created', payload: '{"id":1}' });
    service.saveTemplate({ name: 'my-template', exchange: 'orders', routingKey: 'a', payload: 'p' });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const reloadedService = TestBed.inject(SendHistoryService);

    expect(reloadedService.recentSends().length).toBe(1);
    expect(reloadedService.recentSends()[0].exchange).toBe('orders');
    expect(reloadedService.templates()).toEqual([
      { name: 'my-template', exchange: 'orders', routingKey: 'a', payload: 'p' },
    ]);
  });
});
