import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { TuiButton } from '@taiga-ui/core';

@Component({
  selector: 'app-not-authorized',
  standalone: true,
  imports: [RouterModule, TranslocoDirective, TuiButton],
  templateUrl: './not-authorized.component.html'
})
export class NotAuthorizedComponent {}
