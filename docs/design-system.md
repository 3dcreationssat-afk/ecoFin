# Design System

Tokens are implemented in `src/app/globals.css` and reusable primitives in `src/components/data-display/primitives.tsx`.

## Implemented Tokens

- Background: warm neutral `#f7f4ef` estimated from screenshots.
- Shell: off-white `#fbfaf7` estimated from screenshots.
- Surface: white `#ffffff` directly visible.
- Muted surface: `#f5f2ed` estimated from controls.
- Text: dark neutral `#20242d` estimated for contrast.
- Muted text: `#718096` estimated from labels.
- Primary accent: teal `#258b7f` directly visible.
- Positive: green `#37a77a` chosen for accessibility and screenshot alignment.
- Warning: amber `#d99622` directly visible.
- Critical: red `#dc3f35` chosen for accessibility and screenshot alignment.
- Informational: blue `#2f8eb5` estimated from data-quality states.
- Border: subtle neutral `#e5e0d8` estimated from cards and tables.
- Shadow: low elevation, estimated from cards.

## Typography

- Font: Inter, chosen for readable local implementation.
- Page title: 30px, 600 weight, estimated from screenshots.
- Card values: 30px, 600 weight, directly inferred from large financial values.
- Body: 14-16px with normal line height, estimated from screenshots.
- Section labels: uppercase 12px with positive letter spacing, directly visible.

## Layout

- Sidebar width: 282px, estimated from 2048px screenshots.
- Collapsed sidebar width: 76px, estimated from supplemental collapsible navigation references.
- Header height: 72px, estimated from screenshots.
- Desktop shell: persistent sidebar at `lg` and wider; expanded by default unless the local UI preference is `collapsed`.
- Tablet/mobile shell: off-canvas drawer from the header menu button instead of a permanent rail.
- Cards: 8px radius, subtle border, subtle shadow.
- Tables: full-width, accessible headers, row borders, no dense grid lines.
- Drawer: right side panel over dimmed page; implemented from transaction detail reference.
- Mobile navigation drawer: left side panel over dimmed page; chosen for responsive behavior.
- Breakpoints: desktop persistent/collapsible sidebar; tablet and mobile off-canvas navigation.

## Controls

- Buttons use teal primary or bordered secondary states.
- Status pills use semantic tone colors.
- Focus states use a visible teal outline, chosen for accessibility.
- Reduced motion disables transitions and animations.
- Collapsed navigation uses icon-only controls with accessible names, visible hover/focus tooltips, and explicit expand/collapse labels.
- Active navigation uses `aria-current="page"`, teal fill, and a non-color marker so state is not conveyed by color alone.

## Charts

- Cash-flow chart uses Recharts with teal line, pale fill, dashed grid, and textual metrics.
- Reports use explicit bar values and axis labels.

## Financial Numbers

- Domain helpers format integer minor units as USD.
- Demonstration UI strings remain labeled as demonstration data.
