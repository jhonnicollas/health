---
name: Clinical Precision
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#424656'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#737687'
  outline-variant: '#c2c6d9'
  surface-tint: '#0052dc'
  primary: '#004bca'
  on-primary: '#ffffff'
  primary-container: '#0061ff'
  on-primary-container: '#f1f2ff'
  inverse-primary: '#b4c5ff'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#005c85'
  on-tertiary: '#ffffff'
  tertiary-container: '#0076a9'
  on-tertiary-container: '#eaf4ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#c9e6ff'
  tertiary-fixed-dim: '#89ceff'
  on-tertiary-fixed: '#001e2f'
  on-tertiary-fixed-variant: '#004c6e'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-max-width: 1440px
  gutter: 24px
  margin-desktop: 32px
  margin-tablet: 24px
  margin-mobile: 16px
  sidebar-width: 280px
---

## Brand & Style
The design system is engineered for high-end medical enterprise environments where clarity, reliability, and speed of thought are paramount. The aesthetic follows a **Corporate / Modern** movement, leaning heavily into functional minimalism to reduce cognitive load for healthcare professionals. 

The emotional response should be one of "calm authority"—a digital environment that feels as sterile and precise as a modern clinic, yet as intuitive as a consumer application. We achieve this through generous whitespace, a restricted but purposeful color palette, and a rigorous adherence to a systematic grid.

## Colors
The color strategy centers on **Medical Blue (#0061FF)**, chosen for its high visibility and association with modern technology and trust. 

- **Backgrounds:** We utilize `Slate-50` (#F8FAFC) as the global canvas to reduce eye strain compared to pure white, while maintaining a clean, "paper-like" feel.
- **Surface:** Pure white (#FFFFFF) is reserved for cards and interactive containers to create a clear "layering" effect against the slate background.
- **Accents:** We use a palette of Slate grays for secondary information and borders to ensure the Primary Blue remains the strongest call-to-action signal.
- **Semantic Colors:** Success, Warning, and Error tones are calibrated to meet WCAG AA contrast ratios against both the white card surfaces and the slate background.

## Typography
This design system utilizes **Inter** for all roles, leveraging its systematic rhythm and high legibility in data-heavy interfaces.

- **Scale:** We use a tight scale to ensure maximum information density without sacrificing readability.
- **Hierarchy:** Weight is our primary tool for hierarchy. Headlines use Semi-bold (600) and Bold (700) to anchor sections, while body text stays at Regular (400).
- **Labels:** Small labels and metadata use Medium (500) or Semi-bold (600) at 12px-14px to ensure they remain legible even when secondary in the visual stack.
- **Letter Spacing:** Larger headlines use slight negative tracking (-0.01em to -0.02em) to appear more cohesive, while small labels use positive tracking for clarity.

## Layout & Spacing
The system uses a **Fluid Grid** model with a 4px base unit. 

- **Desktop (1280px+):** A 12-column grid with 24px gutters. The layout features a persistent left-hand sidebar (280px) for high-level navigation.
- **Tablet (768px - 1279px):** The sidebar collapses into a rail or drawer. Margins reduce to 24px.
- **Mobile (<767px):** A 4-column grid with 16px margins.
- **Spacing Rhythm:** Use 8px, 16px, 24px, and 32px increments for internal component spacing to maintain a consistent vertical rhythm.

## Elevation & Depth
The design system employs **Tonal Layers** supplemented by **Ambient Shadows** to define the z-axis. 

- **Level 0 (Background):** Slate-50 (#F8FAFC). Used for the base canvas.
- **Level 1 (Cards/Surface):** Pure White (#FFFFFF). These elements feature a very subtle 1px border (#E2E8F0) and a soft, diffused shadow (0px 4px 6px -1px rgba(0, 0, 0, 0.05)).
- **Level 2 (Dropdowns/Modals):** Pure White with a more pronounced shadow (0px 10px 15px -3px rgba(0, 0, 0, 0.1)) to indicate focus and separation from the clinical data beneath.
- **Interactions:** Buttons and interactive cards should not "lift" excessively on hover; instead, use a subtle fill color shift or a slightly intensified shadow to signal interactivity without breaking the professional "flat" aesthetic.

## Shapes
We adopt a **Soft (0.25rem)** roundedness approach. This subtle rounding provides a modern, approachable feel while maintaining the structural integrity and professional "seriousness" required for a medical application. 

- **Base (4px):** Standard buttons, input fields, and small UI elements.
- **Large (8px):** Primary content cards and containers.
- **Extra Large (12px):** Modals and major layout sections.
- **Pill:** Reserved exclusively for status indicators (Chips/Tags) to distinguish them from actionable buttons.

## Components
- **Buttons:** Primary buttons use the Medical Blue (#0061FF) with white text. Secondary buttons use a Slate-100 fill with Slate-700 text.
- **Cards:** Cards are the primary vessel for patient data. They must have a 1px border in Slate-200 and a Level 1 shadow. Padding inside cards should be a consistent 24px.
- **Input Fields:** Use a 1px border (#CBD5E1). On focus, the border transitions to Primary Blue with a 2px outer "glow" (Primary Blue at 10% opacity).
- **Sidebar Navigation:** Use a dark slate background (#1E293B) or a very light slate (#F1F5F9). Active states should be indicated by a Primary Blue vertical bar on the left edge and a subtle background tint.
- **Status Chips:** Use low-saturation background tints of the semantic colors (e.g., Error Red at 10% opacity) with high-saturation text of the same hue for maximum glanceability.
- **Data Tables:** High-density rows (40px-48px height) with subtle horizontal dividers (#F1F5F9). Use `Inter` at `body-sm` for table cell data to maximize information per screen.