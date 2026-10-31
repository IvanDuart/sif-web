import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { TuiRoot } from '@taiga-ui/core';

import { OverlayLayerService } from './layout/overlay-layer.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TuiRoot, NgComponentOutlet],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly overlay = inject(OverlayLayerService);
}
