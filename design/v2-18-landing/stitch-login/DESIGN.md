---
name: MWLAB 万象
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#444748'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c8c6c5'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e4e2e2'
  on-secondary-container: '#646464'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#370e00'
  on-tertiary-container: '#e65300'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474746'
  secondary-fixed: '#e4e2e2'
  secondary-fixed-dim: '#c8c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb599'
  on-tertiary-fixed: '#370e00'
  on-tertiary-fixed-variant: '#802a00'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display-hero:
    fontFamily: Geist, PingFang SC, HarmonyOS Sans SC, sans-serif
    fontSize: 72px
    fontWeight: '600'
    lineHeight: 80px
    letterSpacing: -0.03em
  display-hero-cjk:
    fontFamily: PingFang SC, HarmonyOS Sans SC, Geist, sans-serif
    fontSize: 68px
    fontWeight: '500'
    lineHeight: 80px
    letterSpacing: 0em
  headline-lg:
    fontFamily: Geist, PingFang SC, HarmonyOS Sans SC, sans-serif
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist, PingFang SC, HarmonyOS Sans SC, sans-serif
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Geist, PingFang SC, HarmonyOS Sans SC, sans-serif
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.01em
  body-default:
    fontFamily: Inter, PingFang SC, HarmonyOS Sans SC, sans-serif
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: -0.005em
  body-default-cjk:
    fontFamily: PingFang SC, HarmonyOS Sans SC, Inter, sans-serif
    fontSize: 13px
    fontWeight: '350'
    lineHeight: 18px
    letterSpacing: 0em
  body-strong:
    fontFamily: Inter, PingFang SC, HarmonyOS Sans SC, sans-serif
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.005em
  body-compact:
    fontFamily: Inter, PingFang SC, HarmonyOS Sans SC, sans-serif
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  label-numeric:
    fontFamily: JetBrains Mono, monospace
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: -0.01em
  label-numeric-sm:
    fontFamily: JetBrains Mono, monospace
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0em
  label-numeric-lg:
    fontFamily: JetBrains Mono, monospace
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: -0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.125rem
  space-sm: 0.25rem
  space-md: 0.5rem
  space-lg: 0.75rem
  space-xl: 1rem
---

## Brand & Style

This design system establishes a high-performance business intelligence workbench tailored for global trade fair directors, project heads, and market researchers. Drawing deeply from the disciplined, high-density aesthetic of Linear, the design language communicates precision, velocity, and institutional rigor.

The interface treats complex data sets, exhibitor profiles, and pipeline metrics as first-class architectural materials. Rather than overwhelming users with unnecessary decoration, it balances ultra-high information density with airy elevation, delicate 1px translucent hairlines, and absolute chromatic restraint. The emotional response is one of surgical competence, clarity under pressure, and effortless data discovery.

## Colors

The palette operates under strict hierarchical discipline to maintain focus on mission-critical exhibition data:

- `--color-canvas` (`#ffffff`): The primary document and viewport background.
- `--color-sidebar` (`#f2f2f2`): Neutral ground for global navigation, structural framing, and persistent tooling panels.
- `--color-surface` (`#fafafa`): Background for grouped content panels, filters, data grids, and cards.
- `--color-surface-elevated` (`#ffffff`): Context menus, popovers, active dialogs, and floating command bars.
- `--color-surface-hover` (`#e6e6e6`): Interactive hover state for items, table rows, and secondary buttons.
- `--color-hairline` (`rgba(0, 0, 0, 0.08)`): Ubiquitous structural divider ensuring crisp panel definition without heavy visual load.
- `--color-hairline-active` (`rgba(0, 0, 0, 0.21)`): Accentuated borders for focused inputs, selected rows, and active states.
- `--color-fg` (`#171717`): Dominant foreground text, primary glyphs, and high-emphasis data points.
- `--color-fg-muted` (`#4d4d4d`): Secondary metadata, column labels, descriptions, and structural icons.
- `--color-fg-subtle` (`#8f8f8f`): Placeholder copy, hotkey hints, timestamp indicators, and disabled actions.
- `--color-fg-faint` (`#a8a8a8`): Inactive iconography, subtle separators, and peripheral meta tags.
- `--color-accent` (`#171717`) & `--color-accent-fg` (`#ffffff`): High-contrast monochrome action buttons and selected tag chips.
- `--color-brand` (`#fe5c00`): **Strictly isolated.** Appears exclusively within the top-left MWLAB brand logo mark. Never use this token for CTAs, alerts, active states, charts, or highlights elsewhere in the system.

## Typography

The type system prioritizes high-density tabular and hierarchical reading:

1. **Latin & Display:** Rendered in `Geist` for crisp headlines and `Inter` for fluent reading at micro scale.
2. **Numeric Values & Indicators:** All numbers, exhibition metrics (sqm, revenue, booth counts, dates, IDs, timestamps, keyboard shortcuts) must strictly render in `JetBrains Mono`.
3. **CJK Rule:** Chinese copy utilizes `PingFang SC` / `HarmonyOS Sans SC`. CJK text must never inherit negative letter-spacing (`letter-spacing: 0`). CJK weights are calibrated one full step lower than Latin (e.g., Latin 600 pairs with CJK 500; Latin 400 pairs with CJK 300/350) to retain optical equilibrium.
4. **Hero Displays:** Screen dashboard banners utilize 72px for Latin and 68px for CJK headers with balanced line heights.

## Layout & Spacing

The workbench layout uses a high-density, multi-pane shell structure:
- **Left Primary Dock:** Fixed 220px (collapsible to 56px) backed by `--color-sidebar`.
- **Secondary Tooling/Filter Pane:** 280px collapsible panel for exhibition facets, search queries, and tag trees.
- **Main Canvas:** Fluid grid, bordered continuously by hairlines with `0.75rem` (12px) column gutters and `1rem` (16px) global padding margins.
- **Micro Rhythms:** Gaps strictly follow a fine 2px/4px/8px micro-metric (`space-xs: 2px`, `space-sm: 4px`, `space-md: 8px`, `space-lg: 12px`, `space-xl: 16px`). This preserves screen real estate, maximizing visible data rows without visual clutter.

## Elevation & Depth

In keeping with the Linear visual philosophy, visual hierarchy is produced via architectural hairline boundaries and layered surface tonality rather than aggressive dropshadows:

- **Level 0 (Flat Canvas):** Surfaces sit flush against `--color-canvas` or `--color-surface`, separated solely by 1px `--color-hairline`.
- **Level 1 (Hovered Panels / Cards):** No drop shadow; transition background to `--color-surface-hover` or elevate border to `--color-hairline-active`.
- **Level 2 (Popovers, Command Palettes, Flyouts):** Background in `--color-surface-elevated`, bordered by 1px `--color-hairline-active`, supported by a hyper-subtle ambient blur shadow: `0 8px 24px -4px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)`.
- **Level 3 (Modal Modifiers):** Centered dialogs backed by a delicate scrim `rgba(255, 255, 255, 0.8)` with backdrop filter `blur(4px)`.

## Shapes

The design system enforces an intentional, tightly controlled corner radius scale:
- `2px` (`radius-xs`): Tags, keyboard shortcut badges (`<kbd>`), micro indicators, and checkbox hit-areas.
- `4px` (`radius-sm`): Default standard for buttons, text inputs, table row highlights, and dropdown menu items.
- `6px` (`radius-md`): Floating toolbars, sub-panels, segmented control tabs, and nested container cards.
- `8px` (`radius-lg`): Maximum corner limit; reserved for dialog windows, command center palettes, and sliding flyout drawers.

Pills and overly rounded organic shapes are strictly prohibited to maintain an architectural, software-instrument appearance.

## Components

### Buttons
- **Primary:** Background `--color-accent` (`#171717`), text `--color-accent-fg` (`#ffffff`), radius `4px`, padding `4px 10px`, typography `12px/16px medium`. Focus ring: 1px offset with `--color-hairline-active`.
- **Secondary / Ghost:** Background transparent, text `--color-fg-muted`, radius `4px`, border `1px solid --color-hairline`. Hover state shifts background to `--color-surface-hover` and text to `--color-fg`.
- **Kbd Action:** Secondary button combined with an inline numeric key tag (`JetBrains Mono`, 10px, background `--color-surface`, radius `2px`, border `1px solid --color-hairline`).

### Data Tables & Lists
- Compact row height of 32px or 36px.
- Bottom border: `1px solid --color-hairline`.
- Header columns: `11px`, uppercase, tracking `0.04em`, `--color-fg-subtle`, font weight `500`.
- Cells containing quantitative metrics (booth size sqm, rev, dates) rendered in `JetBrains Mono` right-aligned. Hovering a row triggers `--color-surface-hover` background seamlessly.

### Input Fields & Search Bars
- Background: `--color-canvas` or `--color-surface`.
- Border: `1px solid --color-hairline`, transitioning to `1px solid --color-hairline-active` on focus with zero glowing shadows.
- Text: 13px `--color-fg`, placeholder `--color-fg-subtle`.
- Inline quick-search palette items feature leading icons (`14px`) in `--color-fg-muted`.

### Chips & Badges
- Height: 20px, radius: `2px` or `4px`, padding: `0 6px`.
- Status neutral: Background `--color-surface`, border `1px solid --color-hairline`, text `--color-fg-muted` (11px `JetBrains Mono`).
- Status active: Background `--color-accent`, text `--color-accent-fg`.

### Checkboxes & Radios
- Size: 14x14px, radius: `2px` for checkboxes, circular for radios.
- Border: `1px solid --color-hairline-active`. Checked state fills with `--color-accent` with a crisp white tick mark.

### Floating Command Bar (K-Bar)
- Fixed width of 560px, radius `8px`, background `--color-surface-elevated`, border `1px solid --color-hairline-active`.
- Shadow `0 16px 32px -8px rgba(0, 0, 0, 0.12)`.
- Features rapid filtering across trade fair editions, exhibitor contracts, and lead assignments.