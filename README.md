# MindspaceProject

A small internal dashboard starter built with Next.js 15, React 19, TypeScript,
App Router, and ESLint. Uses npm, a `src/` directory, self-hosted fonts, and
Lucide icons. No authentication or backend integration is included.

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
		(dashboard)/          # Shared dashboard layout and routes
			activity/page.tsx
			projects/page.tsx
			layout.tsx
			page.tsx
		globals.css           # Shared styles and responsive layout
		layout.tsx            # Root document, fonts, and metadata
	components/
		layout/               # Shared application shell and navigation
	features/
		dashboard/
			components/         # Dashboard-specific UI
			data.ts             # Typed mock data; replace with a data layer
			types.ts            # Feature contracts
	lib/
		format.ts             # Shared date formatting
public/                   # Static assets
```

Routes and data-driven pages are Server Components by default. Only navigation
and project filtering use Client Components. The `@/*` alias resolves to `src/*`.
The route group `(dashboard)` does not appear in URLs. Add feature folders when
new domains are introduced; keep shared UI in `components/` and utilities in `lib/`.

## Checks

```sh
npm run lint
npm run typecheck
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

No `vercel.json`, environment variables, or static-export settings are required.
When adding integrations, keep server-only secrets out of `NEXT_PUBLIC_*`
variables and configure them separately for Vercel Preview and Production.

**Access note:** No authentication is implemented. The application is publicly
accessible wherever deployed unless access is restricted at the hosting or
network layer. Use Vercel Deployment Protection or an equivalent organization
access policy before adding sensitive internal data. The `noindex` metadata is
not an access control.