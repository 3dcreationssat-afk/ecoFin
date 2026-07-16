# Design Decisions

## Base44 Chrome Excluded

- Reference behavior: screenshots include Base44 editor and preview chrome around the app.
- Implemented behavior: only Financial Compass app chrome is implemented.
- Reason: hosted preview controls are not part of the product.
- Accessibility impact: reduces irrelevant controls.
- Responsive impact: improves available space.
- Product impact: preserves product identity.

## Responsive Sidebar

- Reference behavior: desktop screenshots show a persistent left sidebar.
- Implemented behavior: sidebar is persistent on large screens and hidden on smaller screens.
- Reason: the reference set is desktop-sized; mobile needs a usable layout.
- Accessibility impact: prevents cramped navigation.
- Responsive impact: content remains readable on mobile.
- Product impact: navigation model remains consistent on desktop.

## Values Are Demonstration Data

- Reference behavior: screenshots show financial values.
- Implemented behavior: values are displayed with a demonstration badge and documented as synthetic.
- Reason: financial engines are not yet validated.
- Accessibility impact: clearer trust boundary.
- Responsive impact: none.
- Product impact: avoids presenting placeholder calculations as financial truth.

## Collapsible And Mobile Navigation

- Reference behavior: original screenshots show a persistent expanded desktop sidebar; supplemental enhancement references add expanded, collapsed, tablet, and mobile navigation states.
- Implemented behavior: desktop navigation can collapse and persists the preference locally; tablet and mobile use an off-canvas navigation drawer with Escape/backdrop close and focus return to the trigger.
- Reason: improves responsive usability while preserving the approved navigation model.
- Accessibility impact: icon-only items retain accessible labels, visible hover/focus tooltips, active links use `aria-current`, and the active state includes a marker beyond color.
- Responsive impact: content has more space at constrained widths and mobile navigation is reachable.
- Product impact: preserves the local-data indicator and route recognition in all navigation modes.
- Intentional differences: the implementation omits Base44 editor chrome, uses the product's existing Lucide icon set, and keeps tablet navigation in the same drawer pattern as mobile rather than showing a narrow permanent rail.

## Disabled Planned Controls

- Reference behavior: screenshots show Add, Import, export, strategy, contribution, and editor controls.
- Implemented behavior: controls outside Phase 1 persistence scope are disabled or explicitly labeled as demonstration-only/planned.
- Reason: prevents silent no-op behavior from implying unsupported functionality.
- Accessibility impact: disabled controls expose titles and visible planned labels where practical.
- Responsive impact: no material impact.
- Product impact: clarifies Phase 1 boundaries before CSV import begins.

## Recurring Review Workspace

- Recurring financial totals use five balanced summary cards; operational counts such as items
  under review and price increases appear beside review actions instead of creating an orphaned
  metric row.
- The default list shows current and reviewable items. Rejected, canceled, and inactive history
  remains available through the Status filter.
- Dense recurrence fields are grouped into Schedule and Decision columns, while row actions use
  visible labels in addition to icons. The table retains contained horizontal scrolling on narrow
  viewports.
- These are presentation and review-workflow choices only; detection, persisted statuses, and
  recurring financial calculations are unchanged.
