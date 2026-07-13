# Toast Notification Service — Usage Guide

## Overview

The `NotificationService` provides beautiful toast notifications using Taiga UI's `TuiToastService`. Toasts appear in the **top-right corner** with automatic styling, animations, and responsive behavior for both desktop and mobile.

## Basic Usage

### Success Notification

```typescript
import { NotificationService } from '@app/core/ui/notification.service';

export class MyComponent {
  constructor(private notify: NotificationService) {}

  onSuccess() {
    this.notify.success('Operation completed successfully');
    // Auto-closes after 3 seconds
  }
}
```

### Error Notification

```typescript
this.notify.error('Something went wrong');
// Auto-closes after 5 seconds (longer for readability)
```

### Warning Notification

```typescript
this.notify.warning('Please review before proceeding');
// Auto-closes after 4 seconds
```

### Info Notification

```typescript
this.notify.info('New update available');
// Auto-closes after 3 seconds
```

## Advanced Options

### Custom Auto-Close Time

```typescript
// Stay for 7 seconds
this.notify.success('Saved!', 7000);

// Don't auto-close (user must click close button)
this.notify.success('Important notification!', Infinity);
```

### Using the Generic `show()` Method

```typescript
this.notify.show('Custom message', {
  status: 'warning',
  autoClose: 6000,
  closable: true
});
```

## Toast Appearance

Toast notifications automatically display with:

- **Light Mode**: White background with colored left border and content text
- **Dark Mode**: Dark background with adjusted colors for contrast
- **Responsive**: Adapts layout for desktop and mobile devices
- **Animations**: Smooth slide-in and slide-out transitions
- **Accessibility**: Full keyboard support and screen reader compatible

### Status Types & Colors

| Status | Appearance | Color |
|--------|-----------|-------|
| **Success** | Positive | Green |
| **Error** | Negative | Red |
| **Warning** | Warning | Amber |
| **Info** | Info | Blue |

All colors adapt automatically for light and dark themes.

## Position

Toasts appear at the **top-right corner** of the viewport with:
- Fixed positioning
- Stack with automatic spacing for multiple toasts
- Default max 2 toasts visible simultaneously (others queued)
- Swipe-to-dismiss on mobile

## API Reference

### `show(message, options)`

Display a notification with custom options.

**Parameters:**

- `message` (string, required): The notification message
- `options` (NotificationOptions, optional):
  - `status?: 'success' | 'error' | 'warning' | 'info'` — defaults to 'info'
  - `autoClose?: number` — auto-close time in ms (default: 3000). Pass `Infinity` to disable auto-close.
  - `closable?: boolean` — show close button, defaults to true

### `success(message, autoClose?)`

Convenience method for success notifications.

- **Default auto-close**: 3000ms
- **Appearance**: Positive (green)

### `error(message, autoClose?)`

Convenience method for error notifications.

- **Default auto-close**: 5000ms (longer)
- **Appearance**: Negative (red)

### `warning(message, autoClose?)`

Convenience method for warning notifications.

- **Default auto-close**: 4000ms
- **Appearance**: Warning (amber)

### `info(message, autoClose?)`

Convenience method for info notifications.

- **Default auto-close**: 3000ms
- **Appearance**: Info (blue)

## Examples

### Save with Error Handling

```typescript
try {
  await this.api.save(data);
  this.notify.success('Changes saved!');
} catch (error) {
  this.notify.error('Failed to save. ' + error.message);
}
```

### Persistent Alert

```typescript
// Keep visible until user dismisses
this.notify.warning('Connection lost. Reconnecting...', Infinity);
```

### User Action Required

```typescript
if (errors.length > 0) {
  this.notify.show('Please fix the following errors:', {
    status: 'error',
    closable: false  // Force user to acknowledge
  });
}
```

### Custom Timing

```typescript
// Show for 10 seconds
this.notify.success('Update available. Refresh page.', 10000);

// Quick notification
this.notify.info('Copied!', 1000);
```

## Styling Notes

Toast uses Taiga UI's built-in `tui-toast` component with professional styling included. No custom CSS is required for basic functionality.

To customize colors or appearance, you can override Taiga UI design tokens in your `styles.css`:

```css
:root {
  --tui-text-positive: #059669;  /* Success text color */
  --tui-text-negative: #dc2626;  /* Error text color */
  --tui-text-warning: #f59e0b;   /* Warning text color */
  --tui-text-info: #3b82f6;      /* Info text color */
}
```

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Migration from Notification to Toast

If you were previously using `TuiNotificationService`, the API is similar with minor differences:

| Feature | Notification | Toast |
|---------|-------------|-------|
| Import | `@taiga-ui/core` | `@taiga-ui/kit` ✓ |
| Position | Inline in DOM | Fixed (top-right) ✓ |
| Styling | Minimal (custom CSS) | Built-in professional ✓ |
| Responsive | No | Yes ✓ |

The new implementation is simpler and more powerful!
