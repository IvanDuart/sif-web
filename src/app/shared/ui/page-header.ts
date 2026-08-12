import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  templateUrl: './page-header.html'
})
export class PageHeader {
  title = input.required<string>();
  description = input<string>();
}
