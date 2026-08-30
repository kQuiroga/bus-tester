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

  it('defaults the broker signal to RabbitMQ (design D10 — nothing sets Kafka yet)', () => {
    expect(service.broker()).toBe('rabbitmq');
  });

  it('writes the default broker onto <html data-broker> once effects flush', () => {
    TestBed.tick();

    expect(doc.documentElement.dataset['broker']).toBe('rabbitmq');
  });

  it('reflects setBroker("kafka") onto <html data-broker>', () => {
    service.setBroker('kafka');
    TestBed.tick();

    expect(service.broker()).toBe('kafka');
    expect(doc.documentElement.dataset['broker']).toBe('kafka');
  });

  it('switches the attribute back when the broker changes again', () => {
    service.setBroker('kafka');
    TestBed.tick();
    expect(doc.documentElement.dataset['broker']).toBe('kafka');

    service.setBroker('rabbitmq');
    TestBed.tick();
    expect(doc.documentElement.dataset['broker']).toBe('rabbitmq');
  });

  it('is a root-provided singleton', () => {
    expect(TestBed.inject(BrokerAccentService)).toBe(service);
  });
});
