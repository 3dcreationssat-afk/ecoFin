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

