# Workspace Renewal Tracker

## Problem

Account managers need visibility into contracts that are about to expire.

## Solution

Dashboard showing upcoming renewals and revenue at risk.

## Architecture

```text
Browser
↓
Next.js
↓
API Route
↓
Salesforce / Mock Data
```

## Environment Variables

```dotenv
SALESFORCE_INSTANCE_URL=https://my-org.my.salesforce.com
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=
SALESFORCE_ACCESS_TOKEN=
SALESFORCE_API_VERSION=65.0
CONTRACTS_DATA_SOURCE=mock
SALESFORCE_REVENUE_CURRENCY=EUR
SALESFORCE_MULTI_CURRENCY=false
```

Replace the example URL with your Salesforce instance URL. For local development,
set it in `.env.local`, which is ignored by Git. `.env.example` is a safe template
for the repository. All variables are server-side; do not add a `NEXT_PUBLIC_`
prefix or put credentials in the URL. Leave credentials blank in the template.

- `SALESFORCE_INSTANCE_URL`: your HTTPS Salesforce My Domain origin for the
	Client Credentials token endpoint. Do not use a Lightning UI URL or
	`login.salesforce.com` / `test.salesforce.com` for this flow.
- `SALESFORCE_CLIENT_ID` and `SALESFORCE_CLIENT_SECRET`: Consumer Key and Secret
	of the app with Client Credentials Flow and an approved Run As user. Both are
	required for automatic OAuth and take priority over a manual access token.
- `SALESFORCE_ACCESS_TOKEN`: optional fallback for local/manual testing when
	neither Client ID nor Secret is configured. Not needed in Vercel with OAuth.
- `SALESFORCE_API_VERSION`: optional REST API version, default `65.0` (without
	the `v` prefix). Set a version supported by your org.
- `CONTRACTS_DATA_SOURCE`: `mock` by default. Set `salesforce` to load org data
  locally or on Vercel. No app authentication is added: the page and API are
  public when hosting protection is not enabled. Use only demo data.
- `SALESFORCE_REVENUE_CURRENCY`: must be `EUR` before loading real contracts.
	This confirms that the queried revenue uses EUR; do not relabel USD as EUR.
- `SALESFORCE_MULTI_CURRENCY`: `false` for a single-currency org, `true` if
	multi-currency is enabled. In that mode each record must have EUR CurrencyIsoCode.

## Deployment

GitHub → Vercel

Use the Next.js framework preset, Node.js 22.x, `npm ci` as the install command,
and `npm run build` as the build command. Keep the default Next.js output directory.

The project `.npmrc` selects `https://registry.npmjs.org/`, and the lockfile uses
public npm tarball URLs so Vercel does not require access to a corporate package
registry. Commit `.npmrc`, `package.json`, and `package-lock.json` together when
changing dependencies. `npm test` checks that the lockfile remains portable.
After fixing installation configuration, push the changes and redeploy in Vercel
with the existing Build Cache disabled.

In Vercel Project Settings → Environment Variables, configure the My Domain URL,
Client ID, Client Secret, API version, EUR/multi-currency settings, and
`CONTRACTS_DATA_SOURCE=salesforce` for Production. Mark Client Secret as Sensitive
where available. Preview can remain `mock`; never provide credentials to untrusted
preview deployments. A manual access token is not required.

Save variables and redeploy the updated code. `.env.example` is only a template,
not Vercel configuration. Do not copy local corporate proxy variables to Vercel.
Detailed steps and verification: [Vercel deployment guide](docs/Vercel-Deployment.md).

## Future Salesforce Integration

Replace mock data with Salesforce REST API.

The server-only service in `src/lib/salesforce.ts` exports
`getSalesforceAccounts(): Promise<SalesforceAccount[]>`. It queries the standard
Account fields `Id`, `Name`, `BillingCity`, and `BillingCountry`, follows query
pagination, and returns only those fields. Account types live in
`src/types/salesforce.ts`. Call the service only from a protected Server Component,
Route Handler, or server job:

```ts
import { getSalesforceAccounts } from "@/lib/salesforce";

const accounts = await getSalesforceAccounts();
```

Requests use the OAuth token as a Bearer header, disable caching and redirects,
and time out after 15 seconds per request. Invalid pagination cannot send the token
to another origin. `SalesforceApiError` contains a safe message and, for HTTP
failures, a `status`; upstream response bodies and credentials are not logged or
included in errors. A 401 indicates an invalid or expired token.

With Client ID/Secret configured, the service obtains a token on the server using
`grant_type=client_credentials`. It caches the token in memory for up to five
minutes (less if `expires_in` requires it), deduplicates parallel token requests,
and renews/retries once on an API 401. Each Vercel function instance has its own
cache; cold starts can obtain new tokens. OAuth failures are sanitized. Tokens
are never returned to the browser, stored in Git, or logged. Manual-token fallback
does not auto-renew. No refresh token is used in Client Credentials Flow.

`getSalesforceContracts()` queries `Workspace_Contract__c`, validates its custom
fields, and maps records to WorkspaceContract. It reuses the secure pagination
and requires confirmed EUR revenue. The `/api/contracts` Salesforce mode
calculates risk fields and returns `dataSource: "salesforce"`; the UI shows a
Salesforce label. Empty results stay empty, and failures never fall back to mock.
See `docs/Salesforce-Setup.md` for the local test steps.

No public Account endpoint is added. This is a public demo without user
authentication: only test contract data should be visible to Run As. Production
use with sensitive information requires access control. Run `npm test` for mocked integration
tests; they use fake tokens and do not call a Salesforce org.