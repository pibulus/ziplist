# UI Components

This directory contains reusable UI components used throughout the ZipList application.

## Components

### Mascot

`Mascot.svelte` is the **portable SoftStack app-mascot/icon component** — the
shared standard for app mascots across sister apps (ZipList dude, TalkType
ghost, future apps). It encapsulates the float bob, blinking eyes, idle "tappable"
aura, hover glow, focus ring, reduced-motion handling, and — most importantly —
the **matched sizing scale**.

#### Why this exists

Sister apps should have matchy-matchy mascots. They're matched by _visible ink_,
not box size: TalkType's ghost renders ~106px of actual art on mobile (in a
larger box with internal padding). The Mascot defaults render the same ~105–110px
of visible ink on mobile up to ~160px on large desktop, so the mascots read as
the same size side by side. Don't eyeball a percentage — match the ink.

#### Usage

```svelte
<script>
  import { Mascot } from "$lib/components/ui";
</script>

<Mascot
  baseSrc="/assets/ziplist-icon-base.svg"
  eyesSrc="/assets/ziplist-icon-eyes.svg"
  ariaLabel="Start recording"
  on:click={handleClick}
/>
```

For fully custom art, use the default slot instead of `baseSrc`/`eyesSrc`:

```svelte
<Mascot ariaLabel="Open" on:click={...}>
  <MyCustomGhost />
</Mascot>
```

#### Props

| Prop          | Type    | Default | Description                                               |
| ------------- | ------- | ------- | --------------------------------------------------------- |
| `baseSrc`     | string  | `""`    | Body / base SVG layer (optional if using the slot)        |
| `eyesSrc`     | string  | `""`    | Eyes SVG layer; blinks on a timer (optional)              |
| `ariaLabel`   | string  | `""`    | Accessible label; also gates button-vs-static rendering   |
| `interactive` | boolean | `true`  | `true` renders a `<button>`; `false` a decorative `<div>` |
| `float`       | boolean | `true`  | Idle float bob                                            |
| `aura`        | boolean | `true`  | Idle "tappable" aura ring (interactive only)              |

Emits a `click` event when interactive.

#### Sizing tokens (resize without forking breakpoints)

Override these CSS custom properties on any parent to resize — the responsive
breakpoint logic stays in the component:

| Token                  | Default    | Breakpoint     |
| ---------------------- | ---------- | -------------- |
| `--mascot-size-mobile` | `110px`    | `< 640px`      |
| `--mascot-size-sm`     | `120px`    | `>= 640px`     |
| `--mascot-size-md`     | `140px`    | `>= 768px`     |
| `--mascot-size-lg`     | `160px`    | `>= 1024px`    |
| `--mascot-gap`         | `0.625rem` | bottom spacing |

Aura/glow/focus colors are also tokenized (`--mascot-aura-color-1..3`,
`--mascot-hover-glow`, `--mascot-focus-ring`) so each app can match its palette.

#### Porting to another app

1. Copy `Mascot.svelte` into the target app's component tree.
2. Drop in the app's two-layer icon SVGs (or pass custom art via the slot).
3. Keep the default size tokens for cross-app consistency; only override if the
   app's art has different internal padding (re-measure the visible ink).

### AppSuffix

`AppSuffix.svelte` is a specialized component that adds the ".app" suffix to the ZipList brand name.

#### Usage

```svelte
<script>
  import { AppSuffix } from '$lib/components/ui';
</script>

<h1>
  ZipList
  <span style="position: relative; display: inline-block; width: 0; height: 0; overflow: visible;">
    <AppSuffix
      offsetX="-0.3em"
      offsetY="8px"
      position="bottom-right"
    />
  </span>
</h1>
```

#### Props

| Prop            | Type    | Default          | Description                                                      |
| --------------- | ------- | ---------------- | ---------------------------------------------------------------- |
| `color`         | string  | `"inherit"`      | The text color of the suffix                                     |
| `size`          | string  | `"40%"`          | Size relative to parent (40% of parent font size)                |
| `customClass`   | string  | `""`             | Additional CSS classes                                           |
| `offsetX`       | string  | `"-0.2em"`       | Horizontal positioning offset                                    |
| `offsetY`       | string  | `"6px"`          | Vertical positioning offset                                      |
| `position`      | string  | `"bottom-right"` | Position preset (bottom-right, bottom-left, top-right, top-left) |
| `wiggleOnHover` | boolean | `true`           | Whether to enable hover animation                                |

#### Implementation Details

The component uses absolute positioning to place the `.app` suffix relative to the parent element with highly configurable positioning. Key features:

1. **Flexible Positioning**:
   - Uses absolute positioning with responsive adjustments
   - Parent container should have `position: relative` and ideally `width: 0` with `overflow: visible`
   - Supports four position presets: bottom-right, bottom-left, top-right, top-left
   - Fine-grained control with offsetX and offsetY parameters

2. **Visual Style**:
   - Rotated -2° for an "off-kilter" appearance
   - Inherits font family and weight from parent
   - Subtle text shadow for dimensionality
   - 40% of parent font size by default (adjustable)

3. **Hover Effect**:
   - Subtle scale and additional rotation on hover
   - Smooth transitions for all animations

4. **Accessibility**:
   - Marked as `aria-hidden="true"` since it's decorative

5. **Responsive Behavior**:
   - Position and size adjusts across different screen sizes
   - Custom breakpoints for various device sizes
   - Maintains proportional positioning across screen sizes
   - Works in all modern browsers with CSS variable support

#### Example in AnimatedTitle

See `/src/lib/components/mainPage/AnimatedTitle.svelte` for a complete implementation example with proper centering and animation sequencing.
