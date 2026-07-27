import { Component, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiButton, TuiDialogContext } from '@taiga-ui/core';
import { TuiTable } from '@taiga-ui/addon-table';
import { TranslocoPipe } from '@jsverse/transloco';
import { ShoppingListDto, ShoppingListItemDto } from '../../core/api/models/shopping-list.model';
import { NotificationService } from '../../core/ui/notification.service';

export interface ShoppingListDialogInput {
  shoppingList: ShoppingListDto;
}

const SUPERMARKET_LABELS: Record<string, string> = {
  MERCADONA: 'Mercadona',
  CARREFOUR: 'Carrefour',
  LIDL: 'Lidl',
  ALCAMPO: 'Alcampo',
  DIA: 'Dia',
  EL_CORTE_INGLES: 'El Corte Inglés',
  ALDI: 'Aldi',
  EROSKI: 'Eroski',
  CONSUM: 'Consum',
  HIPERCOR: 'Hipercor',
  MASYMAS: 'Mas y Mas',
};

@Component({
  selector: 'app-shopping-list-dialog',
  standalone: true,
  imports: [FormsModule, TuiButton, TuiTable, TranslocoPipe],
  templateUrl: './shopping-list.dialog.html',
  encapsulation: ViewEncapsulation.None,
  styles: [`
    tui-dialog[data-size=l]:has(app-shopping-list-dialog) {
      inline-size: 80vw;
    }
  `],
})
export class ShoppingListDialog {
  private readonly notify = inject(NotificationService);
  readonly context = injectContext<TuiDialogContext<void, ShoppingListDialogInput>>();

  items: ShoppingListItemDto[] = this.context.data.shoppingList.items.map(i => ({ ...i }));
  supermarket = this.context.data.shoppingList.supermarket;

  supermarketLabel(): string {
    return SUPERMARKET_LABELS[this.supermarket] || this.supermarket;
  }

  get totalPrice(): number {
    return this.items.reduce((s, i) => s + (i.estimatedPrice || 0), 0);
  }

  close(): void {
    this.context.$implicit.complete();
  }

  addItem(): void {
    this.items.push({
      id: crypto.randomUUID(),
      name: '',
      quantity: 1,
      unit: 'unidad',
      category: '',
      estimatedPrice: 0,
      checked: false,
      notes: '',
      sortOrder: this.items.length,
    });
  }

  deleteItem(index: number): void {
    this.items.splice(index, 1);
  }

  copyToClipboard(): void {
    const grouped = new Map<string, ShoppingListItemDto[]>();
    for (const item of this.items) {
      const cat = item.category || 'Otros';
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(item);
    }

    let text = `Lista de la Compra - ${this.supermarketLabel()}\n`;
    text += `Total estimado: ${this.totalPrice.toFixed(2)} €\n\n`;

    for (const [category, items] of grouped) {
      text += `[${category}]\n`;
      for (const item of items) {
        const qty = item.quantity ? `${item.quantity}${item.unit ? ' ' + item.unit : ''}` : '';
        const price = item.estimatedPrice ? ` - ${item.estimatedPrice.toFixed(2)} €` : '';
        const notes = item.notes ? ` (${item.notes})` : '';
        text += `- ${item.name}: ${qty}${notes}${price}\n`;
      }
      text += '\n';
    }

    navigator.clipboard.writeText(text).then(() => {
      this.notify.success('Lista copiada al portapapeles');
    }).catch(() => {
      this.notify.error('No se pudo copiar la lista');
    });
  }
}
