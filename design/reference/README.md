# Financial Compass UI Reference

These screenshots were created in Base44 and represent the approved visual direction for Financial Compass.

They are visual references only. They do not prove that the displayed calculations or interactions are implemented.

## Mandatory design characteristics

- Warm neutral application background
- White elevated content surfaces
- Teal principal accent
- Restrained amber warning and confidence states
- Compact persistent left navigation
- Compact global header
- Large, readable financial values
- Subtle borders and shadows
- Moderate corner radius
- Clear local-data privacy indicator
- Safe to Save as the primary decision metric
- Decision-oriented presentation
- Minimal visual noise
- Charts accompanied by explicit text values

## Permitted improvements

Codex may improve:

- Accessibility
- Responsive behavior
- Keyboard interaction
- Sidebar behavior on shorter displays
- Laptop layout of financial summary cards
- Text contrast
- Empty states
- Loading states
- Validation states
- Clearer explanation of moderate or low confidence

Any visible deviation should be documented in `docs/design-decisions.md`.

## Prohibited changes

Do not replace the approved design with:

- A generic admin dashboard
- An unmodified shadcn template
- A cryptocurrency or trading interface
- A heavily card-based dashboard
- A different navigation model
- Neon colors
- Excessive gradients
- Glassmorphism
- Gamification

## Screenshot notes

### Overview

Establishes the primary application shell and hierarchy:

- Grouped left navigation
- Persistent local-data indicator
- Global period selector
- Household selector
- Global search
- Add and Import actions
- Financial summary row
- Safe to Save highlighted
- Confidence badge
- Monthly cash-flow view
- Prior-month comparison
- Demonstration-data label

### Transactions

Shows:

- Filter toolbar
- Sticky transaction table
- Account, category, and status filters
- Saved views
- Review and duplicate states
- Positive and negative transaction treatment

### Transaction detail drawer

Shows:

- Original imported data
- Editable normalized values
- Category and transaction type
- Notes
- Transfer matching
- Split transaction
- Exclusion
- Merchant-rule action
- Audit-history location

### Cash Flow

Shows:

- Current cash position
- Remaining income
- Remaining expenses
- Projected month-end
- Recorded, scheduled, and forecast distinctions
- Balance timeline through month-end

### Safe to Save

Shows:

- Transparent calculation breakdown
- Reserved amounts
- Recommended and conservative amounts
- Confidence explanation
- Specific data-quality conditions affecting confidence

### Budget

Shows:

- Budgeted, actual, forecast, remaining, and prior-month values
- Fixed and essential-variable groups
- Progress and status
- Inline editing affordances

### Recurring Expenses

Shows:

- Monthly and annual totals
- Essential, optional, and under-review classifications
- Price increase visibility
- Recommendation states
- Potential-savings selection behavior

### Debt Planner

Shows:

- Debt summaries
- Avalanche, snowball, and custom strategies
- Extra-payment control
- Payoff order
- Strategy impact
- Estimated debt-free date and interest savings

### Goals and Sinking Funds

Shows:

- Total saved and target
- Planned versus required monthly contributions
- Competing-goals warning
- Progress and on-track states
- Goal-level contribution actions

### Decision Simulator

Shows:

- Isolated scenario assumptions
- Reusable scenario components
- Before-and-after comparison
- Difference column
- Interpretation and risks section
- Scenario changes do not alter real data

### Reports

Shows:

- Report type and comparison controls
- Print, CSV, and HTML actions
- Summary metrics
- Category chart with explicit axis values

### Data Quality

Shows:

- Overall confidence
- Severity counts
- Confidence by calculation area
- Data-quality issues affecting financial outputs

### Accounts

Shows:

- Assets, debts, and net worth
- Account balances and metadata
- Credit limits, APR, due date, and last-updated state
- Account refresh affordance

### Settings

Shows:

- Household settings
- Categories
- Merchant rules
- Import profiles
- Backup and data
- Privacy
- Financial month start
- Income schedule
- Checking buffer
- Emergency fund target
- Debt strategy

## Implementation guidance

Use the screenshots as the visual source of truth, while preserving:

1. Financial correctness
2. Privacy
3. Accessibility
4. Data integrity
5. Responsive usability

The implementation should use maintainable design tokens and reusable components rather than hard-coded page-specific styling.

Base44 preview chrome visible outside the Financial Compass application should not be reproduced.
