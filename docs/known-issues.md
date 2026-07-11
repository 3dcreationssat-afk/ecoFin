# Known Issues

- Financial engines are not implemented; UI values are synthetic demonstration data.
- Safe-to-save, cash-flow, budget forecast, recurring detection, debt payoff, and decision scenario outputs remain demonstration-only.
- Transaction import is not implemented.
- Base44 screenshots were used as static references; exact pixel values are estimated.
- Report Print, CSV, and HTML export controls are disabled because export is not implemented.
- Demo reset is single-household and intended for the synthetic local dataset only; production backup/restore is not implemented.
- Date and duration formatting are not fully centralized.
- `npm audit` and `npm audit --omit=dev` report a moderate Next.js/PostCSS advisory. The reported fix is a semver-major downgrade to `next@9.3.3`, so it was not applied.
