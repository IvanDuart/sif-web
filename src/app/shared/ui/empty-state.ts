import { Component, input, output } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [TuiButton],
  templateUrl: './empty-state.html'
})
export class EmptyState {
  icon = input('fa-solid fa-inbox');
  title = input.required<string>();
  description = input.required<string>();
  actionLabel = input<string>();
  actionIcon = input('fa-solid fa-plus');
  action = output<void>();
}
