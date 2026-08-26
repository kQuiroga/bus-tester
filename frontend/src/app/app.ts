import { Component, ChangeDetectionStrategy } from '@angular/core';
import { HlmToaster } from '@spartan-ng/helm/sonner';
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
}
