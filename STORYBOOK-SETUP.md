# Storybook Setup Guide — SIF-WEB Design System (Phase 7)

**Purpose**: Centralized component library, design token preview, and visual regression baseline.

---

## 📋 Prerequisites

```bash
# Check if Storybook is already installed
npm list @storybook/angular

# If not installed, install Storybook for Angular
npm install --save-dev @storybook/angular @storybook/blocks @storybook/components
```

---

## 🔧 Configuration Files

### **1. `.storybook/main.js` — Storybook Configuration**

```js
const config = {
  stories: ['../src/**/*.stories.ts'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-designs', // For design token preview
  ],
  framework: {
    name: '@storybook/angular',
    options: {
      entryPoint: '',
    },
  },
  docs: {
    autodocs: 'tag',
  },
};

export default config;
```

### **2. `.storybook/preview.ts` — Global Styles & Decorators**

```ts
import type { Preview } from '@storybook/angular';
import '../src/styles.less';
import '../src/app/app.config'; // Tailwind config

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // Viewport presets
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: {
            width: '375px',
            height: '667px',
          },
        },
        tablet: {
          name: 'Tablet',
          styles: {
            width: '768px',
            height: '1024px',
          },
        },
        desktop: {
          name: 'Desktop',
          styles: {
            width: '1440px',
            height: '900px',
          },
        },
      },
    },
  },
  
  // Theme switcher decorator
  decorators: [
    (story) => {
      const container = document.querySelector('body');
      return {
        template: `
          <div style="padding: 2rem; background: var(--tui-background); color: var(--tui-text-primary); min-height: 100vh;">
            <ng-container>{{ story }}</ng-container>
          </div>
        `,
      };
    },
  ],
};

export default preview;
```

### **3. `.storybook/manager.js` — Storybook UI Configuration**

```js
import { addons } from '@storybook/manager-api';
import { create } from '@storybook/theming';

addons.setConfig({
  theme: create({
    base: 'light',
    brandTitle: 'SIF-WEB Design System',
    brandUrl: 'https://github.com/your-org/sif-web',
    brandImage: 'https://path-to-logo.svg',
    colorPrimary: '#059669', // Emerald
    colorSecondary: '#0f172a', // Navy
  }),
});
```

---

## 📚 Story Files

Create story files colocated with components:

```
src/app/
  shared/
    ui/
      empty-state.ts
      empty-state.html
      empty-state.stories.ts  ← New
      
  layout/
    shell/
      shell.ts
      shell.scss
      shell.stories.ts  ← New
```

---

## 🎨 Example Stories

### **1. Empty State Stories** (`empty-state.stories.ts`)

```ts
import { Meta, StoryObj } from '@storybook/angular';
import { EmptyState } from './empty-state';

const meta: Meta<EmptyState> = {
  title: 'Shared/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: {
    design: {
      type: 'figma',
      url: 'https://figma.com/file/your-design/sif-web',
    },
  },
  argTypes: {
    icon: {
      control: 'text',
      description: 'FontAwesome icon class',
      defaultValue: 'fa-solid fa-inbox',
    },
    title: {
      control: 'text',
      description: 'Empty state title',
    },
    description: {
      control: 'text',
      description: 'Empty state description',
    },
    actionLabel: {
      control: 'text',
      description: 'Action button label (optional)',
    },
    actionIcon: {
      control: 'text',
      description: 'Action button icon',
      defaultValue: 'fa-solid fa-plus',
    },
  },
};

export default meta;
type Story = StoryObj<EmptyState>;

export const Patients: Story = {
  args: {
    icon: 'fa-solid fa-user-injured',
    title: 'No Patients',
    description: 'No patients found. Create your first patient record to get started.',
    actionLabel: 'Add Patient',
  },
};

export const Appointments: Story = {
  args: {
    icon: 'fa-solid fa-calendar-check',
    title: 'No Appointments',
    description: 'No appointments scheduled. Create your first appointment to get started.',
    actionLabel: 'Schedule Appointment',
  },
};

export const Menus: Story = {
  args: {
    icon: 'fa-solid fa-utensils',
    title: 'No Menus',
    description: 'No dietary menus created yet. Start by creating a new menu template.',
    actionLabel: 'Create Menu',
  },
};

export const Generic: Story = {
  args: {
    icon: 'fa-solid fa-inbox',
    title: 'No Data',
    description: 'There is no data to display at this time.',
  },
};

export const Loading: Story = {
  render: (args) => ({
    props: args,
    template: `
      <boneyard-skeleton name="empty-state" [loading]="true">
        <app-empty-state [icon]="icon" [title]="title" [description]="description"></app-empty-state>
      </boneyard-skeleton>
    `,
  }),
  args: {
    title: 'Loading...',
    description: 'Please wait',
  },
};
```

---

### **2. Data Card Stories** (`data-card.stories.ts`)

```ts
import { Meta, StoryObj } from '@storybook/angular';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-data-card-story',
  standalone: true,
  template: `
    <div class="data-card" [attr.data-brand-tint]="brandTint ? true : null">
      <h3 class="font-display font-bold text-lg mb-2">{{ title }}</h3>
      <p class="text-sm text-surface-600 dark:text-surface-400">{{ content }}</p>
    </div>
  `,
})
class DataCardStoryComponent {
  @Input() title = 'Card Title';
  @Input() content = 'This is card content';
  @Input() brandTint = false;
}

const meta: Meta<DataCardStoryComponent> = {
  title: 'Shared/DataCard',
  component: DataCardStoryComponent,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    content: { control: 'text' },
    brandTint: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<DataCardStoryComponent>;

export const Default: Story = {
  args: {
    title: 'Dashboard Card',
    content: 'Standard card with default white/dark background.',
    brandTint: false,
  },
};

export const WithBrandTint: Story = {
  args: {
    title: 'Brand Tinted Card',
    content: 'Card with subtle brand tint applied via data-brand-tint attribute.',
    brandTint: true,
  },
};
```

---

### **3. Button Stories** (`button.stories.ts`)

```ts
import { Meta, StoryObj } from '@storybook/angular';
import { Component, Input } from '@angular/core';
import { TuiButton, TuiIconButton } from '@taiga-ui/core';

@Component({
  selector: 'app-button-story',
  standalone: true,
  imports: [TuiButton, TuiIconButton],
  template: `
    <div class="flex flex-wrap gap-4 items-center">
      <button tuiButton [appearance]="appearance" [size]="size" [disabled]="disabled">
        <ng-container *ngIf="icon; else noIcon">
          <i [class]="icon"></i>{{ label }}
        </ng-container>
        <ng-template #noIcon>{{ label }}</ng-template>
      </button>
      
      <button tuiIconButton [appearance]="appearance" [size]="size" [disabled]="disabled">
        <i class="fa-solid fa-check"></i>
      </button>
    </div>
  `,
})
class ButtonStoryComponent {
  @Input() label = 'Button';
  @Input() appearance: 'primary' | 'secondary' | 'flat' = 'primary';
  @Input() size: 'm' | 's' | 'l' = 'm';
  @Input() disabled = false;
  @Input() icon: string | null = null;
}

const meta: Meta<ButtonStoryComponent> = {
  title: 'Components/Button',
  component: ButtonStoryComponent,
  tags: ['autodocs'],
  argTypes: {
    appearance: {
      control: 'select',
      options: ['primary', 'secondary', 'flat'],
    },
    size: {
      control: 'select',
      options: ['s', 'm', 'l'],
    },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<ButtonStoryComponent>;

export const Primary: Story = {
  args: { label: 'Primary Button', appearance: 'primary' },
};

export const Secondary: Story = {
  args: { label: 'Secondary Button', appearance: 'secondary' },
};

export const Flat: Story = {
  args: { label: 'Flat Button', appearance: 'flat' },
};

export const WithIcon: Story = {
  args: { label: 'Add Patient', appearance: 'primary', icon: 'fa-solid fa-plus' },
};

export const Disabled: Story = {
  args: { label: 'Disabled Button', appearance: 'primary', disabled: true },
};

export const IconButton: Story = {
  render: (args) => ({
    props: args,
    template: `
      <button tuiIconButton appearance="${args.appearance}">
        <i class="fa-solid fa-cog"></i>
      </button>
    `,
  }),
};
```

---

### **4. Tenant Color Preview Story** (`.storybook/tenant-color-preview.stories.ts`)

```ts
import { Meta, StoryObj } from '@storybook/angular';
import { Component } from '@angular/core';

@Component({
  selector: 'app-tenant-color-preview',
  standalone: true,
  template: `
    <div class="space-y-8">
      <h2 class="text-2xl font-bold mb-6">Tenant Color System</h2>
      
      <div *ngFor="let tenant of tenantColors" class="space-y-2">
        <h3 class="font-bold">{{ tenant.name }} ({{ tenant.hex }})</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Light mode -->
          <div class="space-y-2">
            <h4 class="text-sm font-semibold text-surface-600">Light Mode</h4>
            <div class="space-y-1">
              <div
                *ngFor="let tint of [2, 4, 5, 8, 10, 20]"
                class="p-3 rounded border"
                [ngStyle]="getTintStyle(tenant.hex, tint, false)"
              >
                <span class="text-xs font-mono">{{ tint }}%</span>
              </div>
            </div>
          </div>
          
          <!-- Dark mode -->
          <div class="space-y-2">
            <h4 class="text-sm font-semibold text-surface-400">Dark Mode</h4>
            <div class="space-y-1 p-4 bg-surface-900 rounded">
              <div
                *ngFor="let tint of [2, 4, 5, 8, 10, 20]"
                class="p-3 rounded border"
                [ngStyle]="getTintStyleDark(tenant.hex, tint)"
              >
                <span class="text-xs font-mono text-white">{{ tint }}%</span>
              </div>
            </div>
          </div>
          
          <!-- Buttons -->
          <div class="space-y-2">
            <h4 class="text-sm font-semibold">Interactive States</h4>
            <div class="space-y-1">
              <button
                class="w-full py-2 px-3 text-white rounded font-semibold text-sm"
                [ngStyle]="{'background-color': tenant.hex}"
              >
                Primary
              </button>
              <button
                class="w-full py-2 px-3 rounded font-semibold text-sm border-2"
                [ngStyle]="{'border-color': tenant.hex, 'color': tenant.hex}"
              >
                Secondary
              </button>
              <button
                class="w-full py-2 px-3 rounded font-semibold text-sm"
                [ngStyle]="{'color': tenant.hex}"
              >
                Flat
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
class TenantColorPreviewComponent {
  tenantColors = [
    { name: 'Emerald (Default)', hex: '#059669' },
    { name: 'Blue', hex: '#2563eb' },
    { name: 'Purple', hex: '#7c3aed' },
    { name: 'Red', hex: '#dc2626' },
    { name: 'Amber', hex: '#d97706' },
  ];

  getTintStyle(hex: string, tint: number, isDark: boolean): any {
    // Simplified: in real implementation, use color-mix() or tinycolor
    const opacity = tint / 100;
    return {
      background: `${hex}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
      color: isDark ? '#fff' : '#1e293b',
    };
  }

  getTintStyleDark(hex: string, tint: number): any {
    const opacity = tint / 100;
    return {
      background: `${hex}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
      color: '#f1f5f9',
    };
  }
}

const meta: Meta = {
  title: 'Design System/Tenant Colors',
  component: TenantColorPreviewComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const Preview: Story = {
  render: () => ({
    template: `<app-tenant-color-preview></app-tenant-color-preview>`,
  }),
};
```

---

## 🚀 Running Storybook

```bash
# Development mode with hot reload
npm run storybook

# Build static site (for CI deployment)
npm run build-storybook

# Test visual regression
npm run test:visual
```

---

## 📊 Visual Regression Testing

### **Setup with Chromatic** (Optional, Paid)

```bash
npm install --save-dev chromatic

# Link to Chromatic project
npx chromatic --project-token <token>

# In CI: automatically snapshots and detects visual changes
```

### **Setup with Playwright** (Free, Self-Hosted)

```bash
npm install --save-dev @playwright/test

# Create tests/visual-regression.spec.ts
```

Example `tests/visual-regression.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

const stories = [
  { name: 'EmptyState - Patients', path: 'shared-emptystate--patients' },
  { name: 'Button - Primary', path: 'components-button--primary' },
  { name: 'DataCard - Default', path: 'shared-datacard--default' },
  { name: 'DataCard - BrandTint', path: 'shared-datacard--with-brand-tint' },
];

for (const story of stories) {
  test(`Visual regression: ${story.name}`, async ({ page }) => {
    await page.goto(`http://localhost:6006/?path=/story/${story.path}`);
    await page.waitForLoadState('networkidle');
    
    // Light mode
    await expect(page).toHaveScreenshot(`${story.name}-light.png`);
    
    // Dark mode
    await page.addInitScript(() => document.documentElement.classList.add('dark'));
    await expect(page).toHaveScreenshot(`${story.name}-dark.png`);
  });
}
```

Run:
```bash
npm run test:visual
```

---

## 📦 CI/CD Integration

### **GitHub Actions Workflow** (`.github/workflows/storybook.yml`)

```yaml
name: Storybook Build & Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '22'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Build Storybook
        run: npm run build-storybook
      
      - name: Run visual regression tests
        run: npm run test:visual
      
      - name: Deploy to Chromatic (or Netlify)
        run: npx chromatic --project-token ${{ secrets.CHROMATIC_TOKEN }}
```

---

## ✅ Acceptance Criteria (Phase 7)

- [ ] Storybook configured and running
- [ ] 15+ stories created for core components
- [ ] Tenant color preview story shows all 5 colors × 2 themes
- [ ] Visual regression baseline captured
- [ ] CI/CD pipeline configured for Storybook builds
- [ ] Design token documentation (DESIGN-TOKENS.md) complete and linked
- [ ] Team trained on story format and contribution guidelines

---

## 📝 Story Contribution Guidelines

When creating a new story:

1. **File Location**: Create `.stories.ts` colocated with component
2. **Meta Object**: Define title, tags, argTypes with full descriptions
3. **Export Stories**: One primary + 2-3 variants (light/dark/states)
4. **Parameters**: Link to Figma design if available
5. **Accessibility**: Test with keyboard navigation + screen reader
6. **Responsive**: Show mobile/tablet/desktop viewports

Example template:
```ts
const meta: Meta<YourComponent> = {
  title: 'Category/YourComponent',
  component: YourComponent,
  tags: ['autodocs'],
  parameters: {
    design: { type: 'figma', url: '...' },
  },
  argTypes: {
    prop1: { control: 'text', description: '...' },
  },
};

export const Default: Story = { args: { prop1: 'value' } };
export const Variant: Story = { args: { prop1: 'other' } };
```

---

## 🔗 Related Documentation

- **DESIGN-TOKENS.md** — Token hierarchy and usage
- **CLAUDE.md** — Architecture & conventions (section on Storybook)
- **PRODUCT.md** — Brand voice & messaging
- **Taiga UI Docs** — Component API reference

---

**Created**: August 2026  
**Last Updated**: August 2026  
**Maintainer**: Design System Team
