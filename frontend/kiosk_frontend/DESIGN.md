---
name: AeroGate Light
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3f4850'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#707881'
  outline-variant: '#bfc7d2'
  surface-tint: '#006398'
  primary: '#006194'
  on-primary: '#ffffff'
  primary-container: '#007bb9'
  on-primary-container: '#fdfcff'
  inverse-primary: '#93ccff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#b61722'
  on-tertiary: '#ffffff'
  tertiary-container: '#da3437'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cce5ff'
  primary-fixed-dim: '#93ccff'
  on-primary-fixed: '#001d31'
  on-primary-fixed-variant: '#004b73'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410004'
  on-tertiary-fixed-variant: '#930013'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.02em
  display-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 44px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: 0em
  body-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '400'
    lineHeight: 32px
    letterSpacing: 0em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: 0em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.03em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2.5rem
  space-xs: 0.5rem
  space-sm: 1rem
  space-md: 1.5rem
  space-lg: 2.5rem
  space-xl: 4rem
---

## Brand & Style

This design system is engineered for automated airport e-Gate kiosks, immigration biometric gates, and passenger processing terminals. The interface must guide anxious, fatigued, or multilingual travelers with effortless clarity. The core emotional signature is calm efficiency, hospitality, and unmistakable direction.

The aesthetic follows an ultra-clean, architectural minimalism:
- Generous structural whitespace that lowers cognitive load in noisy physical transit environments.
- Human-centric tactile cues tailored strictly for vertical touch displays viewed from 50–90 cm away.
- Absolute rejection of sci-fi HUD clutter, wireframes, dense telemetry, or superfluous biometric facial mesh lines.
- Pristine typographic authority inspired by international airport wayfinding standards, ensuring instant recognition at a glance.

## Colors

The palette pairs high-contrast wayfinding blues with pure, reassuring base neutrals to maximize outdoor and overhead-glare readability.

- **Primary (`#0284C7`)**: Signage cobalt blue, reserved for primary action zones, instructional touch targets, and scan zone indicators.
- **Secondary (`#10B981`)**: Vivid emerald green, exclusively designating successful gate clearance, authentic verification, and passport recognition.
- **Tertiary (`#EF4444`)**: Crisp regulatory red for manual officer intervention, alignment alerts, or blocked access.
- **Warning (`#F59E0B`)**: Radiant amber used sparingly for document repositioning or glare detection notices.
- **Surfaces**: Canvas is `#F8FAFC`, stepping forward to `#FFFFFF` for interactive cards and elevated reader prompts, with `#F1F5F9` for secondary receptacles and inactive troughs.
- **Text & Contrast**: High-contrast midnight navy (`#0F172A`) for headlines and instructions, paired with muted slate (`#475569`) for instructional subtext. This achieves strict WCAG AAA contrast against all functional surfaces.

## Typography

The type system relies entirely on **Plus Jakarta Sans**, chosen for its crisp geometric legibility, balanced apertures, and human warmth. 

- Text sizing is deliberately amplified relative to desktop web standards to accommodate arm's-length interaction and peripheral viewing angles.
- All primary instructional steps use `display-md` or `headline-lg` in semi-bold and bold weights to ensure reading within 1.5 seconds.
- Body sizes never drop below `16px` anywhere on the passenger-facing terminal.
- Sub-labels and meta tags use structured tracking (`0.02em` to `0.05em`) to maintain sharp differentiation against bright fluorescent terminal ambient lighting.

## Layout & Spacing

The layout is optimized for high-aspect vertical touchscreen kiosks (typically 24" to 32" portrait displays at 1080x1920 or 1440x2560 resolutions).

- **Structure**: A single-column vertical flow with three dominant vertical ergonomic zones:
  1. *Status & Language Banner (Top 15%)*: Flight number, gate identity, language switcher.
  2. *Instruction & Interaction Canvas (Middle 60%)*: Large animated physical guidance (e.g., passport placement, camera eye-level targeting), dynamic feedback states.
  3. *Action & Assist Zone (Bottom 25%)*: Reachable touch actions, assistance call buttons, secondary navigation.
- **Rhythm**: Generous base rhythm scaling from `1rem` (16px) for interior containment up to `4rem` (64px) for distinct instructional separation.
- **Touch Margins**: Outer edge buffer of `2.5rem` (40px) to prevent finger-reach collisions with physical hardware bezels.

## Elevation & Depth

To maintain clarity and eliminate visual friction under harsh overhead airport lighting, the system eschews dense skeuomorphism in favor of soft tonal elevation and restrained ambient shadowing.

- **Base Canvas**: Flat `#F8FAFC`.
- **Card Containers**: Solid `#FFFFFF` elevated with an ultra-diffused, cool-tinted ambient shadow (`0 8px 30px rgba(15, 23, 42, 0.05)`) bordered by a crisp `1px` structural outline in `#E2E8F0`.
- **Active / Scan Zones**: Highlighted via tonal shift to `#F0F9FF` with an interactive focal border of `2px solid #0284C7` and an outer glow (`0 0 0 6px rgba(2, 132, 199, 0.12)`).
- **Feedback Overlay / Success Panels**: Solid full-surface or modal states with soft backdrops (`rgba(15, 23, 42, 0.25)`) featuring slight background blur (`8px`) to refocus traveler attention instantly.

## Shapes

The design uses a clean, architectural curvature (roundedness scale 2). 

- Base interactives and touch targets feature `0.5rem` (8px) to `1rem` (16px) corner radius, signaling approachable modern technology without appearing toy-like.
- Hero biometric capture windows and passport placement framing diagrams use `1.5rem` (24px) corner radii to mirror the physical shape of identity booklets and modern optical reader glass.
- Language selector chips and assistance pills feature fully rounded caps (pill shape) to differentiate navigational utilities from sequential gate steps.

## Components

### Buttons
- **Touch Minimum**: Minimum hit area of 64px height and full-width or minimum 200px width.
- **Primary Button**: Solid `#0284C7` background with pure `#FFFFFF` bold text. Includes an active depressed state (`scale(0.98)`).
- **Assistance Button**: Outlined button with `#E2E8F0` border, `#FFFFFF` fill, and `#0F172A` text accompanied by an unmistakable agent headset icon.

### Gate Status Indicator & Feedback Banners
- **Success State**: Rich `#10B981` border with a `#ECFDF5` background tint, displaying a massive centered checkmark icon, passenger name confirmation, and explicit "GATE OPEN - PLEASE PROCEED" copy in `headline-lg`.
- **Alert State**: `#EF4444` border, `#FEF2F2` background, accompanied by simple visual instructions directing the passenger to Station Agent / Officer desk.

### Interactive Placement Cards
- Used to demonstrate physical actions (e.g., "Insert Passport Photo Page Face Down").
- Crisp `#FFFFFF` card with soft interior `#F8FAFC` recessed graphics box.
- Animated directional arrows in `#0284C7` illustrating movement without telemetry grids or technical jargon.

### Biometric Camera Mirror Guide
- Oval viewport with a clean, low-contrast guide ring (`3px solid #CBD5E1`).
- Instantly turns into an affirmative `#10B981` solid ring when the passenger's face is recognized at the proper height and distance.
- Strictly no technical face mesh overlays, tracking points, or biometric metrics displayed to the user.

### Language Switcher Chips
- Placed in the top right corner.
- Inactive: `#FFFFFF` fill with `#CBD5E1` border and 48px touch height.
- Active: `#0F172A` fill with `#FFFFFF` text for immediate state visibility.