# MindspaceProject

A Workspace Renewal Tracker dashboard starter built with Next.js 15, React 19,
TypeScript, App Router, and ESLint. Uses npm, a `src/` directory, self-hosted
fonts, and Lucide icons. Contract renewal information will come from a
server-side API. `GET /api/contracts` currently returns mock contracts. No
authentication or live Salesforce integration is implemented yet.

## Local Development

Use Node.js 22 LTS (see `.nvmrc`) and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Overview (`/`), Projects (`/projects`), and Activity
(`/activity`) use clearly labeled sample data. Search and status filtering run
locally in the browser.

## Project Structure

```text
src/
	app/
		api/contracts/route.ts # Server-side mock contracts API
		(dashboard)/          # Shared dashboard layout and routes
			activity/page.tsx
			projects/page.tsx
			layout.tsx
			page.tsx
		globals.css           # Shared styles and responsive layout
		layout.tsx            # Root document, fonts, and metadata
	components/
		layout/               # Shared application shell and navigation
	data/
		mockContracts.ts      # Fictional Salesforce-style workspace contracts
		renewals.ts           # Empty renewal data placeholder
	features/
		dashboard/
			components/         # Dashboard-specific UI
			data.ts             # Typed mock data; replace with a data layer
			types.ts            # Feature contracts
	lib/
		contract-renewal.ts    # UTC calendar-day and renewal risk calculations
		format.ts             # Shared date formatting
		renewal-api.ts        # Future server-side data loader contract
	types/
		renewal.ts            # Provisional workspace renewal model
		workspace-contract.ts # Contract, derived fields, and API response types
public/                   # Static assets
```

Routes and data-driven pages are Server Components by default. Only navigation
and project filtering use Client Components. The `@/*` alias resolves to `src/*`.
The route group `(dashboard)` does not appear in URLs. Add feature folders when
new domains are introduced; keep shared UI in `components/` and utilities in `lib/`.

## Renewal Tracker Placeholders

The requested `app/`, `components/`, `lib/`, `data/`, and `types/` folders are
present. Existing dashboard routes and sample projects remain unchanged.

- `types/renewal.ts` provides a provisional `WorkspaceRenewal` model with `id`,
	`workspaceName`, and `renewalDate` (an ISO 8601 date string). Adjust it to the
	actual API contract before integration.
- `data/renewals.ts` exports an empty, typed `renewalPlaceholders` array. It is
	not live API data and is not connected to the current UI.
- `lib/renewal-api.ts` defines the `RenewalLoader` function type only. No
	endpoint, fetch implementation, or credentials are configured.

Implement the loader on the server and call it from a Server Component or Route
Handler. Add a `server-only` guard and validate API responses at that boundary
when implementing the integration. Keep credentials in server environment
variables, never in `data/` or client components.

## Contracts API

`GET /api/contracts` returns JSON with `instanceUrl` and `contracts`. Each
contract includes the mock record fields plus `daysRemaining` and `riskLevel`.
Days are calculated from today's UTC calendar date; contracts ending today have
zero days remaining, and expired contracts have negative values.

| Days Remaining | Risk Level |
| --- | --- |
| Less than 30 (including expired) | `Critical` |
| 30 through 90, inclusive | `Warning` |
| Over 90 | `Healthy` |

For local development, set this optional value in `.env.local`:

```dotenv
SALESFORCE_INSTANCE_URL=https://your-org.my.salesforce.com
```

The environment variable is read only in the server route. The response exposes
only its HTTPS origin, stripping user information, paths, query parameters, and
fragments. Missing, invalid, or non-HTTPS URLs produce `instanceUrl: null` while
the mock contracts remain available. No other environment variables or tokens
are returned. Do not put credentials in the instance URL.

The endpoint is dynamic and sends `Cache-Control: no-store` so renewal
calculations are not frozen at build time or served from a stale cache. It does
not call Salesforce and is not yet connected to the dashboard UI.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

`npm start` serves the production build, so run `npm run build` first. Commit the
lockfile and use `npm ci` for repeatable installations.

Next.js 15 currently pins an older PostCSS release. A scoped npm override uses
PostCSS 8.5.30 to address its security advisories while retaining Next.js 15.
Reassess the override when upgrading Next.js. Run `npm audit` regularly; the
ESLint dependency chain currently has upstream advisories without a compatible
fix. Do not use `npm audit fix --force`, which proposes changing framework majors.

## Vercel Deployment

1. Push the project to a Git repository and import it into Vercel.
2. Select the **Next.js** framework preset with the repository root as the Root Directory.
3. Select **Node.js 22.x** in Project Settings.
4. Keep the default install command (`npm ci`), build command (`npm run build`), and output directory.
5. Deploy. Vercel provides preview deployments for pull requests and production deployments from the production branch.

No `vercel.json` or static-export settings are required. Optionally configure
`SALESFORCE_INSTANCE_URL` in Vercel Environment Variables for each deployment
environment, then redeploy. Mock contracts work without this variable.
When adding integrations, keep server-only secrets out of `NEXT_PUBLIC_*`
variables and configure them separately for Vercel Preview and Production.

**Access note:** No authentication is implemented. The application is publicly
accessible wherever deployed unless access is restricted at the hosting or
network layer. Use Vercel Deployment Protection or an equivalent organization
access policy before adding sensitive internal data. The `noindex` metadata is
not an access control.