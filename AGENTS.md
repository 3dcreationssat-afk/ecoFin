<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Financial Compass Agent Rules

## Engineering

- Use Next.js App Router, React, strict TypeScript, Tailwind CSS, Prisma, SQLite, Zod, Vitest, and Playwright.
- Keep the app local-first. Normal local development must not require Docker or remote services.
- Prefer small, reviewed changes with tests for financial logic, persistence contracts, and important UI flows.
- Do not claim a calculation, import flow, or financial engine is implemented until it is backed by code and validation.

## Financial Correctness

- Store money as integer minor units. Store currency separately.
- Do not use JavaScript floating-point arithmetic for money calculations.
- Demonstration values must be labeled as demonstration data.
- Do not provide investment, credit, tax, or legal advice.

## Privacy And Security

- Never request or store bank credentials, card PINs, MFA secrets, security-question answers, or complete card numbers.
- Never commit real financial exports, real balances, account identifiers, statements, secrets, `.env` files, or SQLite databases containing personal data.
- Use synthetic demonstration data only.

## Git

- Review status before committing.
- Keep commits coherent and scoped.
- Do not rewrite or discard user changes unless explicitly requested.

## Change Ledger

- Update `docs/change-ledger.md` for meaningful product, architecture, schema, calculation, or design changes.
