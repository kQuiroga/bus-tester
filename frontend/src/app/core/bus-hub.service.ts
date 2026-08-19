import { InjectionToken, Injectable, inject, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder } from '@microsoft/signalr';
import { HUB_URL } from './api-config';

/** Message pushed by BusHub over SignalR (mirrors BusTester.Infrastructure.MessageReceivedDto). */
export interface ReceivedMessage {
  subscriptionId: string;
  exchange: string;
  routingKey: string;
  payload: string;
  /** Monotonic, assigned at receipt by this service instance — NOT part of the wire DTO. */
  seq: number;
}

/** Shape of the message as it arrives over the wire, before this service stamps `seq`. */
type IncomingMessage = Omit<ReceivedMessage, 'seq'>;

/**
 * DI token for the underlying HubConnection so tests can substitute a fake implementation
 * without opening a real socket.
 */
export const BUS_HUB_CONNECTION = new InjectionToken<HubConnection>('BUS_HUB_CONNECTION', {
  providedIn: 'root',
  factory: () => new HubConnectionBuilder().withUrl(HUB_URL).withAutomaticReconnect().build(),
});

/**
 * Thin wrapper around the SignalR connection to BusHub. Joins/leaves the group for a
 * subscription and keeps a signal of every message pushed to it (newest first), per
 * message-consumption: "Live delivery".
 */
@Injectable({ providedIn: 'root' })
export class BusHubService {
  private readonly connection = inject(BUS_HUB_CONNECTION);
  private readonly _messages = signal<ReceivedMessage[]>([]);
  private startPromise: Promise<void> | null = null;
  private nextSeq = 0;

  readonly messages = this._messages.asReadonly();

  constructor() {
    this.connection.on('MessageReceived', (message: IncomingMessage) => {
      const received: ReceivedMessage = { ...message, seq: this.nextSeq++ };
      this._messages.update((current) => [received, ...current]);
    });
  }

  /** Idempotent: repeated calls return the same in-flight/completed start, never re-invoke it. */
  start(): Promise<void> {
    this.startPromise ??= this.connection.start();
    return this.startPromise;
  }

  joinSubscription(subscriptionId: string): Promise<void> {
    return this.connection.invoke('JoinSubscription', subscriptionId);
  }

  leaveSubscription(subscriptionId: string): Promise<void> {
    return this.connection.invoke('LeaveSubscription', subscriptionId);
  }

  clear(): void {
    this._messages.set([]);
  }
}
