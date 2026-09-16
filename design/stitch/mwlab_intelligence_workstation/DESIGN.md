---
name: MWLAB Intelligence Workstation
colors:
  surface: '#131314'
  surface-dim: '#131314'
  surface-bright: '#3a393a'
  surface-container-lowest: '#0e0e0f'
  surface-container-low: '#1c1b1c'
  surface-container: '#201f20'
  surface-container-high: '#2a2a2b'
  surface-container-highest: '#353436'
  on-surface: '#e5e2e3'
  on-surface-variant: '#e4beb1'
  inverse-surface: '#e5e2e3'
  inverse-on-surface: '#313031'
  outline: '#ab897d'
  outline-variant: '#5b4137'
  surface-tint: '#ffb599'
  primary: '#ffb599'
  on-primary: '#5a1b00'
  primary-container: '#fe5c00'
  on-primary-container: '#511800'
  inverse-primary: '#a73a00'
  secondary: '#ffb599'
  on-secondary: '#5a1b00'
  secondary-container: '#7e2c05'
  on-secondary-container: '#ff9c75'
  tertiary: '#a0caff'
  on-tertiary: '#003259'
  tertiary-container: '#0096fc'
  on-tertiary-container: '#002d51'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbce'
  primary-fixed-dim: '#ffb599'
  on-primary-fixed: '#370e00'
  on-primary-fixed-variant: '#802a00'
  secondary-fixed: '#ffdbce'
  secondary-fixed-dim: '#ffb599'
  on-secondary-fixed: '#370e00'
  on-secondary-fixed-variant: '#7e2c05'
  tertiary-fixed: '#d2e4ff'
  tertiary-fixed-dim: '#a0caff'
  on-tertiary-fixed: '#001c37'
  on-tertiary-fixed-variant: '#00497e'
  background: '#131314'
  on-background: '#e5e2e3'
  surface-variant: '#353436'
  bg-canvas: '#0A0A0B'
  bg-sidebar: '#0E0E10'
  bg-surface: '#141416'
  bg-surface-elevated: '#1A1A1E'
  bg-surface-hover: '#1F1F24'
  border-hairline: rgba(255, 255, 255, 0.07)
  border-active: rgba(255, 255, 255, 0.14)
  text-primary: '#F5F5F7'
  text-secondary: '#8A8A93'
  text-tertiary: '#52525A'
  accent-active: '#FE5C00'
  accent-hover: '#FF7324'
  accent-dim: rgba(254, 92, 0, 0.12)
typography:
  headline-xl:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: -0.005em
  body-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: '0'
  label-code:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Geist
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.06em
  data-tabular:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: -0.01em
  data-tabular-lg:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 20px
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
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.375rem
  space-md: 0.5rem
  space-lg: 0.75rem
  space-xl: 1rem
  space-2xl: 1.5rem
---

## Brand & Style

The design system powers an enterprise-grade M&A intelligence and business development terminal tailored for exhibition industry dealmakers, institutional analysts, and corporate strategists. The aesthetic is cold, analytical, and ruthlessly engineered—drawing directly from the precision of modern devtools, financial terminals, and high-density productivity environments like Linear and Vercel.

The emotional signature is unyielding confidence, operational clarity, and latency-free utility. Visual ornamentation is strictly eliminated; hierarchy is communicated through luminance steps, hairline borders, and rigid spatial discipline. Data density is maximized without sacrificing structural scannability.

## Colors

The palette operates on a strict monochromatic ladder calibrated for dark-mode clarity:
- **Canvas Base (`#0A0A0B`)**: Deep neutral foundation ensuring zero glare during prolonged analytical workflows.
- **Sidebar & Shell (`#0E0E10`)**: Distinct structural tier anchoring permanent operational navigation.
- **Surface Panels (`#141416`)**: Data cards, workspace viewports, and table containers.
- **Hairline Dividers (`rgba(255, 255, 255, 0.07)`)**: Sub-pixel precision separation across adjacent metrics and table cells.

The energetic accent **`#FE5C00`** is strictly rationed. It must never appear as decorative background fills or general icons. It is reserved exclusively for:
1. High-conviction Primary CTAs (e.g., "Confirm Deal Term Sheet", "Execute Export").
2. Active state indicators (active workspace tabs, pipeline indicator dots, real-time sync pulses).
3. Critical metric delta focal points.

## Typography

Typography prioritizes fast ingestion of dense relational data. **Geist** delivers crisp rendering and uncompromised geometric neutral clarity for UI structure and prose. **JetBrains Mono** provides fixed-width alignment for financial figures, M&A multipliers, floor space volumes (sqm), transaction valuations, and micro-metadata labels.

All numeric values in tabular grids, valuation multiples, and deal pipelines must utilize tabular figures (`font-feature-settings: "tnum" 1`) to eliminate optical jitter across real-time dynamic refreshes.

## Layout & Spacing

Layout geometry follows an engineered multi-pane docking model optimized for ultrawide and dual-monitor financial setups. The primary structure is built on a 3-tier division:
1. **Utility Navigation Sidebar (64px collapsed / 220px expanded)**: Docked at `#0E0E10`.
2. **Entity Master Tree / Deal Ledger View (280px - 340px)**: Resizable left partition.
3. **Multi-Tab Data Canvas & Analytical Splitter View**: Fills remaining horizontal canvas using a fluid sub-grid.

The spacing rhythm is calibrated to an ultra-dense 4px/8px modular base. Structural margins sit at `1rem`, internal card containers pad at `0.75rem`, and row gutters contract to `0.375rem` - `0.5rem`. Layout components prioritize screen real estate, eliminating generous negative space in favor of information band density.

## Elevation & Depth

This design system rejects skeuomorphic drop shadows and heavy blurred elevations in favor of strict **Tonal Layering** and **Sub-pixel Hairlines**:

- **Tier 0 (Base Canvas)**: `#0A0A0B` - Foundation background for split screens and frame gutters.
- **Tier 1 (Surface Panels)**: `#141416` bounded by continuous `1px solid rgba(255, 255, 255, 0.07)` borders.
- **Tier 2 (Hover & Active Focus States)**: `#1F1F24` with high-contrast hairline `rgba(255, 255, 255, 0.14)`.
- **Tier 3 (Floating Overlays, Command Palette, Filter Popovers)**: `#1A1A1E` with a subtle technical drop border: `0 0 0 1px rgba(255, 255, 255, 0.1), 0 8px 24px -4px rgba(0, 0, 0, 0.8)`. No diffuse glow effects.

## Shapes

The design language uses tight, machined corner radii (`roundedness: 1`). 
- Standard interactives (buttons, inputs, dropdown tags, badges): `4px` (`0.25rem`).
- Workspace structural frames, modals, and split-pane viewports: `6px` (`0.375rem`).
- Micro status indicators and pill dots: `9999px` (strictly restricted to geometric circular indicator nodes).

Zero pill buttons or rounded organic shapes are permitted; every boundary conveys architectural precision.

## Components

### Buttons
- **Primary CTA**: `#FE5C00` background, `#0A0A0B` bold text, `4px` border-radius, `height: 28px`, `padding: 0 10px`. Hover: `#FF7324`. Active: opacity 0.9. Restricted to one per panel context.
- **Secondary / Ghost**: `#141416` surface, `1px solid rgba(255, 255, 255, 0.07)` border, `#F5F5F7` text. Hover: `#1F1F24` background and `rgba(255, 255, 255, 0.14)` border.
- **Tool / Icon Button**: Transparent background, `24px x 24px`, `#8A8A93` fill. Hover: `#141416` surface, `#F5F5F7` fill.

### Data Tables (Workstation Density)
- **Header Cell**: `height: 28px`, `#0E0E10` background, `#52525A` uppercase mono typography (`label-caps`), bottom border `1px solid rgba(255, 255, 255, 0.07)`.
- **Row Specs**: `height: 32px` standard row, `28px` dense mode. Alternating states prohibited; rows delineate purely through `#0A0A0B` / `#141416` with `1px hairline border-bottom`. Hover triggers instant `#1F1F24` highlight across the entire horizontal span.
- **Data Cells**: Tabular numbers aligned right (`font-family: JetBrains Mono`), alphanumeric identifiers aligned left (`Geist`). Active deal tracking row marked by a `2px` left border in `#FE5C00`.

### Input Fields & Search Bars
- Background: `#0E0E10`, border: `1px solid rgba(255, 255, 255, 0.07)`, height: `28px`, text: `#F5F5F7`, placeholder: `#52525A`.
- Focus state: border color transitions to `#8A8A93` with zero exterior glow ring. Includes inline keyboard shortcut badges (`JetBrains Mono`, `10px`, `#52525A`).

### Status Badges & Deal Tags
- Compact structure: `height: 18px`, `padding: 0 6px`, `border-radius: 2px`.
- Inactive/Draft: Background `rgba(255, 255, 255, 0.04)`, text `#8A8A93`.
- Active Opportunity / Pipeline Target: Background `rgba(254, 92, 0, 0.12)`, border `1px solid rgba(254, 92, 0, 0.3)`, text `#FE5C00`.

### Selection Controls
- **Checkboxes & Radios**: `14px x 14px`, `2px` radius for checkboxes, `border: 1px solid rgba(255, 255, 255, 0.15)`. Active checked state: `#FE5C00` fill with `#0A0A0B` checkmark icon.