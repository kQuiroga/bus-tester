import { TestBed } from '@angular/core/testing';
import { ReplyDraftService, ReplyTarget } from './reply-draft.service';

describe('ReplyDraftService', () => {
  let service: ReplyDraftService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReplyDraftService);
  });

  it('starts with a null draft', () => {
    expect(service.draft()).toBeNull();
  });

  it('request(target) publishes the target with seq 1 on the first call', () => {
    const target: ReplyTarget = { routingKey: 'reply.queue.1', correlationId: 'corr-1' };

    service.request(target);

    expect(service.draft()).toEqual({ target, seq: 1 });
  });

  it('request() with the same target twice bumps seq from 1 to 2 so a repeat click re-fires', () => {
    const target: ReplyTarget = { routingKey: 'reply.queue.1', correlationId: 'corr-1' };

    service.request(target);
    expect(service.draft()).toEqual({ target, seq: 1 });

    service.request(target);
    expect(service.draft()).toEqual({ target, seq: 2 });
  });

  it('request() keeps incrementing seq across different targets', () => {
    const first: ReplyTarget = { routingKey: 'reply.queue.1', correlationId: 'corr-1' };
    const second: ReplyTarget = { routingKey: 'reply.queue.2', correlationId: null };

    service.request(first);
    service.request(second);

    expect(service.draft()).toEqual({ target: second, seq: 2 });
  });

  it('clear() nulls the draft', () => {
    service.request({ routingKey: 'reply.queue.1', correlationId: 'corr-1' });

    service.clear();

    expect(service.draft()).toBeNull();
  });
});
