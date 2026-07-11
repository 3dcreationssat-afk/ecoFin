# Financial Compass — Collapsible Navigation Enhancement

This package supplements the original Base44 design references.

It focuses on improving the application shell and adding a polished collapsible
left navigation while preserving the approved Financial Compass visual language.

## Objective

Allow the user to collapse and expand the left navigation without losing:

- Route recognition
- Keyboard accessibility
- Local-data status
- Main content context
- Header usability
- Visual fidelity
- Responsive behavior

## Reference states

### Expanded navigation

The expanded state should preserve:

- Financial Compass wordmark
- Group labels
- Route icon and text
- Active-route highlight
- Accounts and Settings
- Local-data privacy indicator
- Bottom collapse affordance

### Collapsed navigation

The collapsed state should preserve:

- Financial Compass icon
- Route icons
- Active-route highlight
- Tooltips or accessible labels
- Local-data shield icon
- Bottom expand affordance
- Clear visual separation from content

The collapsed state should not simply hide text and leave awkward spacing.

## Required behavior

### Desktop

- Default to expanded on large desktop widths unless the user previously chose
  collapsed.
- Support an explicit collapse/expand control.
- Persist the user's preference locally.
- Animate width and label visibility subtly.
- Respect reduced-motion preferences.
- Keep the main content width responsive.
- Prevent layout jumping or horizontal overflow.
- Keep the header aligned with the content area.

### Laptop

- Allow either expanded or collapsed state.
- Prefer collapsed automatically only when available width becomes constrained,
  unless doing so would override a deliberate user preference.
- Maintain all primary header actions.

### Tablet

- Use an overlay or drawer pattern instead of a permanently narrow sidebar.
- Do not reduce the content area to an unusable width.
- Support closing with Escape and clicking outside.

### Mobile

- Use a menu button and off-canvas navigation.
- Do not render the desktop sidebar as a permanently visible icon rail.
- Restore focus to the trigger after closing.

## Accessibility

- Every icon-only navigation item must have an accessible name.
- Provide visible tooltips for pointer users in collapsed mode.
- Preserve keyboard navigation.
- Maintain visible focus states.
- Mark the active route with `aria-current="page"`.
- The collapse/expand button needs an explicit accessible label.
- Avoid hover-only discovery.
- Do not rely on color alone for active state.
- Respect `prefers-reduced-motion`.

## Local-data indicator

In expanded mode show:

- Shield icon
- “Local data”
- “Stored on this device”

In collapsed mode show:

- Shield icon
- Accessible label and tooltip
- A stable position near the bottom of the rail

Do not remove the privacy signal when the sidebar is collapsed.

## Persistence

Store only the navigation preference locally.

Recommended behavior:

- `expanded`
- `collapsed`
- Optional `system` or `auto` mode only if clearly documented

Do not store financial data in browser local storage merely to implement this
feature.

Avoid hydration mismatch in Next.js. Apply the saved preference safely after
client initialization or through a compatible persisted UI-preference layer.

## Visual guidance

Preserve:

- Warm neutral background
- White surfaces
- Teal active state
- Compact iconography
- Rounded active navigation item
- Subtle borders
- Low visual noise
- Existing sidebar/header proportions

Avoid:

- Overly narrow icon rail
- Centering icons inconsistently
- Abrupt content jumps
- Excessive animation
- Hidden navigation labels without tooltips
- A second vertical scrollbar caused by the sidebar
- Reproducing Base44 preview chrome

## Expected implementation evidence

Capture and compare screenshots for:

1. Expanded desktop
2. Collapsed desktop
3. Tablet overlay
4. Mobile drawer
5. Keyboard focus state
6. Dark theme, if supported

Record intentional differences in `docs/design-decisions.md`.
