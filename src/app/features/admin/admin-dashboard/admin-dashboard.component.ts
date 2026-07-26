import { Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [TranslocoDirective],
  templateUrl: './admin-dashboard.component.html'
})
export class AdminDashboardComponent {}
