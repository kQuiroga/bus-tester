import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleX, lucideLoaderCircle } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmBadge } from '@spartan-ng/helm/badge';

/**
 * Body of the connect popup (connection-status spec: "Connection UI Is a Load-Time Popup
 * That Collapses to a Status Pill"). Presentational: it switches on {@link connected} —
 * the credentials form while disconnected, disconnect/switch controls while connected, and
 * never re-prompts for credentials once connected.
 */
@Component({
  selector: 'app-connect-dialog',
  standalone: true,
  imports: [FormsModule, HlmButton, HlmInput, HlmLabel, HlmBadge, NgIcon],
  providers: [provideIcons({ lucideCircleX, lucideLoaderCircle })],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './connect-dialog.component.html',
})
export class ConnectDialogComponent {
  readonly connected = input(false);
  readonly pending = input(false);
  readonly errorMessage = input<string | null>(null);

  readonly host = model('localhost');
  readonly port = model(5672);
  readonly username = model('guest');
  readonly password = model('guest');

  readonly connectSubmit = output<void>();
  readonly disconnect = output<void>();
  readonly changeBroker = output<void>();

  submit(): void {
    this.connectSubmit.emit();
  }
}
