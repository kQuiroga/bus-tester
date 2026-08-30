import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/core';
import { BrokerAccentService } from './broker-accent.service';

describe('BrokerAccentService', () => {
  let service: BrokerAccentService;
  let doc: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    doc = TestBed.inject(DOCUMENT);
    doc.documentElement.removeAttribute('data-broker');
    service = TestBed.inject(BrokerAccentService);
  });

  afterEach(() => {
    doc.documentElement.removeAttribute('data-broker');
  });

  it('starts with no connected broker (decision #167 — neutral accent until a real connection)', () => {
    expect(service.broker()).toBeNull();
  });

  it('leaves <html> without a data-broker attribute while no broker is connected', () => {
    TestBed.tick();

    expect(doc.documentElement.hasAttribute('data-broker')).toBe(false);
  });

  it('reflects setBroker("rabbitmq") onto <html data-broker>', () => {
    service.setBroker('rabbitmq');
    TestBed.tick();

    expect(service.broker()).toBe('rabbitmq');
    expect(doc.documentElement.dataset['broker']).toBe('rabbitmq');
  });

  it('reflects setBroker("kafka") onto <html data-broker>', () => {
    service.setBroker('kafka');
    TestBed.tick();

    expect(service.broker()).toBe('kafka');
    expect(doc.documentElement.dataset['broker']).toBe('kafka');
  });

  it('removes data-broker again when the broker is cleared back to null', () => {
    service.setBroker('kafka');
    TestBed.tick();
    expect(doc.documentElement.dataset['broker']).toBe('kafka');

    service.setBroker(null);
    TestBed.tick();

    expect(service.broker()).toBeNull();
    expect(doc.documentElement.hasAttribute('data-broker')).toBe(false);
  });

  it('is a root-provided singleton', () => {
    expect(TestBed.inject(BrokerAccentService)).toBe(service);
  });
});
