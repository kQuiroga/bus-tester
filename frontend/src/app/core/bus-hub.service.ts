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

/** Lifecycle state of the SignalR hub connection (connection-status spec: "Hub Connection State
 *  Is Exposed Read-Only"). */
export type HubConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

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
  private readonly _connectionState = signal<HubConnectionState>('idle');
  private startPromise: Promise<void> | null = null;
  private nextSeq = 0;

  readonly messages = this._messages.asReadonly();
  readonly connectionState = this._connectionState.asReadonly();

  constructor() {
    this.connection.on('MessageReceived', (message: IncomingMessage) => {
      const received: ReceivedMessage = { ...message, seq: this.nextSeq++ };
      this._messages.update((current) => [received, ...current]);
    });
    this.connection.onreconnecting(() => this._connectionState.set('reconnecting'));
    this.connection.onreconnected(() => this._connectionState.set('connected'));
    this.connection.onclose(() => this._connectionState.set('disconnected'));
  }

  /** Idempotent: repeated calls return the same in-flight/completed start, never re-invoke it. */
  start(): Promise<void> {
    if (!this.startPromise) {
      this._connectionState.set('connecting');
      this.startPromise = this.connection.start().then(
        () => {
          this._connectionState.set('connected');
        },
        (err: unknown) => {
          this._connectionState.set('disconnected');
          throw err;
        },
      );
    }
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
