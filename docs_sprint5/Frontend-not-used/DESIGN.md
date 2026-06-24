---
name: 'Clinical Precision: Women''s Health'
colors:
  surface: '#fcf8fa'
  surface-dim: '#dcd9db'
  surface-bright: '#fcf8fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f5'
  surface-container: '#f0edef'
  surface-container-high: '#eae7e9'
  surface-container-highest: '#e4e2e4'
  on-surface: '#1b1b1d'
  on-surface-variant: '#45464d'
  inverse-surface: '#303032'
  inverse-on-surface: '#f3f0f2'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#271901'
  on-tertiary-container: '#98805d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#fcdeb5'
  tertiary-fixed-dim: '#dec29a'
  on-tertiary-fixed: '#271901'
  on-tertiary-fixed-variant: '#574425'
  background: '#fcf8fa'
  on-background: '#1b1b1d'
  surface-variant: '#e4e2e4'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

This design system is built on the principles of medical accuracy, privacy, and clinical authority. The target audience is users seeking data-driven insights into their reproductive health without the stereotypical floral or soft-focus aesthetics often found in the category. 

The design style is **Corporate / Modern** with a lean toward **Minimalism**. It prioritizes high-trust interactions through clean data visualization, generous whitespace, and a systematic approach to information density. Every UI element is designed to feel like a professional medical instrument—precise, reliable, and unobtrusive. The emotional response should be one of empowerment through clarity and scientific rigor.

## Colors

The palette is anchored by a Slate-50 (#F8FAFC) background to maintain a sterile, clinical environment. Neutral tones are derived from the Slate scale to provide professional grounding.

The color system utilizes specific semantic tokens for reproductive health tracking, replacing decorative hues with functional indicators:
- **Period Red**: Used exclusively for menstruation flow data and critical cycle markers.
- **Fertile Purple/Blue**: A dual-tone system for ovulation windows and high-fertility peaks, providing clear distinction in data-heavy charts.
- **Safe Green**: Indicates non-fertile windows or "normal" health status readings.

Backgrounds for components should use white (#FFFFFF) to pop against the Slate-50 base, while borders utilize a subtle Slate-200.

## Typography

The design system utilizes **Inter** exclusively to ensure maximum legibility and a systematic, utilitarian feel. The type hierarchy is tight, favoring medium and semi-bold weights for data headers to establish clear priority.

- **Headlines**: Use tight letter-spacing (-0.02em) to maintain a modern, "app-like" density.
- **Data Display**: Numeric values in health logs should use `data-mono` (tabular figures if available) to ensure vertical alignment in charts and lists.
- **Labels**: Small-caps labels are used for secondary metadata to differentiate from actionable body text.

## Layout & Spacing

The layout follows a **Fluid Grid** model with a 12-column structure for desktop and a 4-column structure for mobile. A strict 4px baseline grid ensures vertical rhythm.

- **Margins**: Mobile devices utilize a 16px side margin, while tablets and desktops scale to 24px and 48px respectively.
- **Stacking**: Consistent vertical spacing (8px, 16px, 32px) is used to group related health metrics.
- **Charts**: Specialized data visualizations for cycle tracking should span at least 4 columns on mobile to ensure touch-target precision on individual days.

## Elevation & Depth

To maintain a "Clinical Precision" aesthetic, this design system avoids heavy shadows. Instead, it utilizes **Tonal Layers** and **Low-Contrast Outlines**.

- **Level 0 (Base)**: Slate-50 background.
- **Level 1 (Cards)**: White background with a 1px Slate-200 border. No shadow.
- **Level 2 (Modals/Overlays)**: White background with a 1px Slate-200 border and a very subtle, neutral ambient shadow (Offset: 0, 4px; Blur: 20px; Opacity: 0.05).

Depth is communicated through the physical stacking of elements rather than dramatic lighting.

## Shapes

The shape language is defined by **Rounded-XL (12px)** corners for primary containers and cards. This balance provides a modern feel that is approachable but remains professional and structured.

- **Small elements**: Checkboxes and input fields use a 6px (rounded-md) radius.
- **Buttons**: Use 8px (rounded-lg) to distinguish interactive elements from static containers.
- **Data Markers**: Circular markers (pill-shaped) are reserved for calendar day indicators and status chips.

## Components

- **Buttons**: Primary buttons are Slate-900 with white text. Secondary buttons are white with a Slate-200 border. No gradients or decorative flourishes.
- **Data Chips**: Small, high-contrast badges used for cycle status (e.g., "Follicular Phase"). Use the semantic colors as subtle backgrounds (10% opacity) with full-color text.
- **Charts**: High-precision line and bar graphs. Use `semantic_period_red` for menstruation bars and `semantic_fertile_blue` for temperature/ovulation curves. 
- **Input Fields**: Clean, Slate-200 borders that transition to Slate-900 on focus. Success/Error states utilize `semantic_safe_green` and `semantic_period_red`.
- **Calendar**: A grid-based view where "active" states are marked with 12px rounded-square backgrounds rather than soft circles, maintaining the structural, clinical feel.
- **Lists**: Health logs should be separated by subtle horizontal rules (Slate-100) with generous 16px padding to ensure legibility of medical data.