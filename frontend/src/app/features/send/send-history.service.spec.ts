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

  it('recordSend caps the list at 20 entries, evicting the oldest (FIFO)', () => {
    for (let i = 0; i < 21; i++) {
      service.recordSend({ exchange: 'orders', routingKey: `orders.${i}`, payload: `{"id":${i}}` });
    }

    const sends = service.recentSends();

    expect(sends.length).toBe(20);
    expect(sends[0].routingKey).toBe('orders.20');
    expect(sends[sends.length - 1].routingKey).toBe('orders.1');
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
