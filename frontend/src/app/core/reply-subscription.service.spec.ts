import { TestBed } from '@angular/core/testing';
import { ReplySubscriptionService } from './reply-subscription.service';

describe('ReplySubscriptionService', () => {
  let service: ReplySubscriptionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReplySubscriptionService);
  });

  it('starts with an empty pending list', () => {
    expect(service.pending()).toEqual([]);
  });

  it('add() appends a new pending subscription', () => {
    service.add({ subscriptionId: 'sub-1', correlationId: 'corr-1' });

    expect(service.pending()).toEqual([{ subscriptionId: 'sub-1', correlationId: 'corr-1' }]);
  });

  it('add() appends multiple pending subscriptions, preserving insertion order', () => {
    service.add({ subscriptionId: 'sub-1', correlationId: 'corr-1' });
    service.add({ subscriptionId: 'sub-2', correlationId: 'corr-2' });

    expect(service.pending()).toEqual([
      { subscriptionId: 'sub-1', correlationId: 'corr-1' },
      { subscriptionId: 'sub-2', correlationId: 'corr-2' },
    ]);
  });

  it('remove(subscriptionId) removes only the matching entry, leaving others intact', () => {
    service.add({ subscriptionId: 'sub-1', correlationId: 'corr-1' });
    service.add({ subscriptionId: 'sub-2', correlationId: 'corr-2' });

    service.remove('sub-1');

    expect(service.pending()).toEqual([{ subscriptionId: 'sub-2', correlationId: 'corr-2' }]);
  });

  it('remove() with an unknown subscriptionId is a no-op', () => {
    service.add({ subscriptionId: 'sub-1', correlationId: 'corr-1' });

    service.remove('does-not-exist');

    expect(service.pending()).toEqual([{ subscriptionId: 'sub-1', correlationId: 'corr-1' }]);
  });
});
