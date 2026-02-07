# iOS Toggle Switches - Visual Reference

## Toggle States

### OFF (Disabled)
```
┌─────────────────────────────┐
│ Your Setting                │
│                             │
│ ○────────────────────────   │  ← Gray (disabled)
└─────────────────────────────┘
```

### ON (Enabled)
```
┌─────────────────────────────┐
│ Your Setting                │
│                             │
│ ────────────────────────○   │  ← Blue (enabled)
└─────────────────────────────┘
```

---

## Animation Sequence

### Clicking Toggle OFF → ON

```
Step 1: Initial (OFF)
├─ Background: #ccc (gray)
├─ Circle: Left (3px from edge)
└─ State: Unchecked

Step 2: Animating (transition: 0.3s)
├─ Background: Transitioning #ccc → #2196F3
├─ Circle: Sliding right
└─ State: Animating

Step 3: Final (ON)
├─ Background: #2196F3 (blue)
├─ Circle: Right (23px from edge)
└─ State: Checked
```

**Total Time**: 0.3 seconds (smooth, not instant)

---

## Dimensions

```
┌─────────────────────────────────┐
│                                 │
│  51px wide × 31px tall          │
│  ┌──────────────────────────┐   │
│  │ Toggle                   │   │
│  │  (rounded edges)         │   │
│  │                          │   │
│  │  ○ ← 25px circle         │   │
│  │  (with shadow)           │   │
│  └──────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

---

## Color Scheme

| State | Background | Circle | Border |
|-------|-----------|--------|--------|
| OFF (Unchecked) | #ccc (Gray) | white | none |
| ON (Checked) | #2196F3 (Blue) | white | none |
| Disabled | #ccc (opacity 0.6) | white | none |

---

## CSS Animation Easing

```
Position: ease-in-out (default)
Time: 0.3 seconds

OFF State                          ON State
(left: 3px)                        (left: 23px - moved 20px)
    │                                 │
    ├─ 0.0s: ○────                  │
    ├─ 0.15s:  ○───  (halfway)      │
    └─ 0.3s:       ○────            ├─ Animation Complete
```

---

## Interactive Behavior

### User Clicks Toggle

```
1. User clicks toggle
   ↓
2. Component state updates (instant)
   ↓
3. Visual animation plays (0.3s)
   ├─ Background color transitions
   ├─ Circle slides smoothly
   └─ Shadow maintains consistency
   ↓
4. API save request sent
   ├─ If success: "Successfully updated..." message
   ├─ If error: "Error..." message
   └─ Message auto-hides after 3s
   ↓
5. Database updated
   ↓
6. Next page load fetches updated value
```

---

## Accessibility

### Keyboard Support
- `Tab` to focus
- `Space` or `Enter` to toggle

### Visual Feedback
- Color change (gray ↔ blue)
- Position change (circle moves)
- Both animations synchronized

### Disabled State
- Opacity: 0.6 (dimmed)
- Cursor: not-allowed
- No click response

---

## Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Latest 2 versions |
| Firefox | ✅ Full | Latest 2 versions |
| Safari | ✅ Full | Latest 2 versions |
| Edge | ✅ Full | Latest 2 versions |
| Mobile Chrome | ✅ Full | iOS/Android |
| Mobile Safari | ✅ Full | iOS 12+ |

Uses standard CSS:
- `:before` pseudo-element
- `transition` property
- `transform: translateX()`
- `border-radius`
- No vendor prefixes needed

---

## Responsive Behavior

```
Desktop / Tablet (wide)
┌───────────────────────────────────────────┐
│ First Trade Bonus Active          ○───    │  ← Toggle on right
└───────────────────────────────────────────┘

Mobile (narrow)
┌─────────────────────────────────┐
│ First Trade Bonus Active        │
│                          ○───   │  ← Still on right, stacked
└─────────────────────────────────┘
```

Layout uses `flex items-center justify-between`:
- Label on left (flexible)
- Toggle on right (fixed 51px width)
- Responsive by design

---

## Copy & Paste: Integration Code

If you want to use iOS toggles elsewhere in the admin portal:

### Add CSS (once per app)
```html
<style id="ios-toggle-styles">
  .ios-toggle {
    position: relative;
    display: inline-block;
    width: 51px;
    height: 31px;
    flex-shrink: 0;
  }

  .ios-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .ios-toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: 0.3s;
    border-radius: 31px;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.15);
  }

  .ios-toggle-slider:before {
    position: absolute;
    content: "";
    height: 25px;
    width: 25px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .ios-toggle input:checked + .ios-toggle-slider {
    background-color: #2196F3;
  }

  .ios-toggle input:checked + .ios-toggle-slider:before {
    transform: translateX(20px);
  }

  .ios-toggle input:disabled + .ios-toggle-slider {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .ios-toggle-container {
    display: flex;
    align-items: center;
    gap: 12px;
  }
</style>
```

### Use in JSX
```tsx
<label className="flex items-center justify-between">
  <div>
    <span className="text-sm font-medium">Your Setting</span>
    <p className="text-xs text-gray-500">Description here</p>
  </div>
  <div className="ios-toggle-container">
    <label className="ios-toggle">
      <input
        type="checkbox"
        checked={myState}
        onChange={(e) => setMyState(e.target.checked)}
        disabled={isLoading}
      />
      <span className="ios-toggle-slider"></span>
    </label>
  </div>
</label>
```

---

## Performance Notes

- **CSS-only animation**: No JavaScript animation libraries needed
- **GPU accelerated**: `transform` uses GPU for smooth 60fps
- **Minimal layout shifts**: Fixed toggle width prevents layout jank
- **Instant feedback**: State updates immediately, animation follows
- **No flash of unstyled content**: CSS in component file

---

## Troubleshooting

### Toggle doesn't animate
→ Check CSS is loaded in `document.head`
→ Verify `transition: 0.3s` is present on `.ios-toggle-slider`

### Colors look wrong
→ Check browser color settings
→ Verify #2196F3 (blue) and #ccc (gray) are correct

### Toggle appears as checkbox
→ CSS not loaded (check for errors in browser console)
→ Clear browser cache (Cmd+Shift+Delete)

### Disabled state doesn't look dimmed
→ Check `.ios-toggle input:disabled + .ios-toggle-slider { opacity: 0.6; }`

---

**Reference**: iOS Toggle Switch Implementation
**Status**: Production Ready ✅
**Last Updated**: February 5, 2026
