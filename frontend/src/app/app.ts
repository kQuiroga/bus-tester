import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { HlmToaster } from '@spartan-ng/helm/sonner';
import { BrokerAccentService } from './core/broker-accent.service';
import { ConnectComponent } from './features/connect/connect.component';
import { SendComponent } from './features/send/send.component';
import { MessagesComponent } from './features/messages/messages.component';

@Component({
  selector: 'app-root',
  imports: [ConnectComponent, SendComponent, MessagesComponent, HlmToaster],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './app.html',
})
export class App {
  protected readonly title = 'BusTester';

  /** Eagerly instantiated so the `<html data-broker>` accent seam is live for the
   *  whole document, including CDK overlays rendered outside `app-root` (design D2). */
  private readonly brokerAccent = inject(BrokerAccentService);
}
