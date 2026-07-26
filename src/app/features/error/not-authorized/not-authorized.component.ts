import { Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-not-authorized',
  standalone: true,
  imports: [TranslocoDirective],
  templateUrl: './not-authorized.component.html'
})
export class NotAuthorizedComponent {}
