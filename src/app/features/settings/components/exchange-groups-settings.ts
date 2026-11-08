import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TuiButton } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';

import { ExchangeService } from '../../../core/api/services/exchange.api';
import { FoodService } from '../../../core/api/services/food.api';
import { ExchangeEquivalentDto, ExchangeGroupDto } from '../../../core/api/models/exchange.model';
import { FoodDto } from '../../../core/api/models/food.model';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { NotificationService } from '../../../core/ui';

@Component({
  selector: 'app-exchange-groups-settings',
  standalone: true,
  imports: [FormsModule, TranslocoDirective, TuiButton, TuiBadge],
  templateUrl: './exchange-groups-settings.html',
})
export class ExchangeGroupsSettings implements OnInit {
  private readonly exchangeService = inject(ExchangeService);
  private readonly foodService = inject(FoodService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);

  readonly groups = signal<ExchangeGroupDto[]>([]);
  readonly equivalents = signal<ExchangeEquivalentDto[]>([]);
  readonly selectedGroupId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly loadingEquivalents = signal(false);
  readonly savingGroup = signal(false);
  readonly savingEquivalent = signal(false);

  readonly newGroupOpen = signal(false);
  newCode = '';
  newName = '';
  newColor = '#22c55e';

  foodQuery = '';
  readonly foodResults = signal<FoodDto[]>([]);
  readonly selectedFood = signal<FoodDto | null>(null);
  readonly searchingFoods = signal(false);
  householdMeasure = '';
  gramsPerRation: number | null = null;
  rationsPerUnit: number | null = 1;

  private readonly foodSearch$ = new Subject<string>();

  constructor() {
    this.foodSearch$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => {
          const tenantId = this.tenantCtx.currentTenantId();
          if (!tenantId || term.trim().length < 2) return of(null);
          return this.foodService.search(tenantId, term.trim());
        })
      )
      .subscribe((result) => {
        this.foodResults.set(result?.foods ?? []);
        this.searchingFoods.set(false);
      });
  }

  ngOnInit(): void {
    this.loadGroups();
  }

  private tenantId(): string | null {
    return this.tenantCtx.currentTenantId();
  }

  loadGroups(): void {
    const tenantId = this.tenantId();
    if (!tenantId) return;

    this.loading.set(true);
    this.exchangeService.listGroups(tenantId).subscribe({
      next: (groups) => {
        this.groups.set(groups ?? []);
        this.loading.set(false);
        const first = groups?.[0];
        if (first && !this.selectedGroupId()) this.selectGroup(first);
      },
      error: () => {
        this.groups.set([]);
        this.loading.set(false);
      },
    });
  }

  selectGroup(group: ExchangeGroupDto): void {
    this.selectedGroupId.set(group.id);
    this.loadEquivalents(group.id);
  }

  selectedGroup(): ExchangeGroupDto | undefined {
    return this.groups().find((group) => group.id === this.selectedGroupId());
  }

  private loadEquivalents(groupId: string): void {
    const tenantId = this.tenantId();
    if (!tenantId) return;

    this.loadingEquivalents.set(true);
    this.exchangeService.listEquivalents(tenantId, groupId).subscribe({
      next: (equivalents) => {
        this.equivalents.set(equivalents ?? []);
        this.loadingEquivalents.set(false);
      },
      error: () => {
        this.equivalents.set([]);
        this.loadingEquivalents.set(false);
      },
    });
  }

  createGroup(): void {
    const tenantId = this.tenantId();
    if (!tenantId || !this.newCode.trim() || !this.newName.trim()) return;

    this.savingGroup.set(true);
    this.exchangeService
      .createGroup(tenantId, {
        code: this.newCode.trim().toUpperCase(),
        name: this.newName.trim(),
        colorHex: this.newColor || null,
      })
      .subscribe({
        next: (group) => {
          this.savingGroup.set(false);
          this.newGroupOpen.set(false);
          this.newCode = '';
          this.newName = '';
          this.newColor = '#22c55e';
          this.notify.success(this.transloco.translate('exchange.group_created'));
          this.loadGroups();
          this.selectGroup(group);
        },
        error: () => {
          this.savingGroup.set(false);
          this.notify.error(this.transloco.translate('exchange.save_error'));
        },
      });
  }

  onFoodQuery(value: string): void {
    this.foodQuery = value;
    this.selectedFood.set(null);
    if (value.trim().length < 2) {
      this.foodResults.set([]);
      this.searchingFoods.set(false);
      return;
    }
    this.searchingFoods.set(true);
    this.foodSearch$.next(value);
  }

  chooseFood(food: FoodDto): void {
    this.selectedFood.set(food);
    this.foodQuery = food.name;
    this.foodResults.set([]);
  }

  clearFood(): void {
    this.selectedFood.set(null);
    this.foodQuery = '';
  }

  addEquivalent(): void {
    const tenantId = this.tenantId();
    const groupId = this.selectedGroupId();
    const food = this.selectedFood();
    if (!tenantId || !groupId || !food || (this.gramsPerRation ?? 0) <= 0) return;

    this.savingEquivalent.set(true);
    this.exchangeService
      .createEquivalent(tenantId, groupId, {
        foodId: food.id,
        rationsPerUnit: this.rationsPerUnit ?? 1,
        householdMeasure: this.householdMeasure.trim() || null,
        gramsPerRation: this.gramsPerRation as number,
      })
      .subscribe({
        next: () => {
          this.savingEquivalent.set(false);
          this.notify.success(this.transloco.translate('exchange.equivalent_created'));
          this.clearFood();
          this.householdMeasure = '';
          this.gramsPerRation = null;
          this.rationsPerUnit = 1;
          this.loadEquivalents(groupId);
        },
        error: () => {
          this.savingEquivalent.set(false);
          this.notify.error(this.transloco.translate('exchange.save_error'));
        },
      });
  }
}
