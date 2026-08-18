import { Component } from '@angular/core';
import { ConnectComponent } from './features/connect/connect.component';
import { SendComponent } from './features/send/send.component';
import { MessagesComponent } from './features/messages/messages.component';

@Component({
  selector: 'app-root',
  imports: [ConnectComponent, SendComponent, MessagesComponent],
  templateUrl: './app.html',
})
export class App {
  protected readonly title = 'BusTester';
}
