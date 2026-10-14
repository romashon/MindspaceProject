# Workspace Renewal Tracker

## Problem

Mindspace account managers need a shared view of expiring contracts to avoid
missed renewals and lost recurring revenue.

## Solution

A dashboard showing contract expiry dates, risk levels, and monthly revenue at
risk, so the team can prioritize renewals before revenue is lost.

## Architecture

```text
Browser -> Next.js /api/contracts -> Salesforce REST API / mock data
```

The React dashboard fetches JSON from a server-side API route, which loads
contracts and calculates risk levels. The UI provides search, filters, and revenue
summaries. Revenue at risk is monthly, not guaranteed losses.

Salesforce mode reads `Workspace_Contract__c` using OAuth Client Credentials.
Secrets stay on the server; failures never silently fall back to mock data.

Experience Cloud is not required. The standalone interface can follow
Mindspace's branding and workflows.

## Configuration

Settings are server-side; use [.env.example](.env.example) as a template:

```dotenv
CONTRACTS_DATA_SOURCE=salesforce # mock or salesforce
SALESFORCE_INSTANCE_URL=https://your-org.my.salesforce.com
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=
SALESFORCE_API_VERSION=65.0
SALESFORCE_REVENUE_CURRENCY=EUR
SALESFORCE_MULTI_CURRENCY=false
```

Choose `mock` or `salesforce`. Salesforce requires My Domain, OAuth credentials,
and EUR amounts. Enable multi-currency if the org uses it; only EUR is supported.

## Deployment

GitHub -> Vercel, using Next.js and Node.js 22.x. Install with `npm ci`; build
with `npm run build`. Set environment variables in Vercel, including
`SALESFORCE_INSTANCE_URL` in salesforce or mock mode.
## Connecting to a Real Salesforce Org

The connection already works. For another org, I would verify field mappings,
OAuth, least-privilege Run As permissions, and currency settings in a sandbox.
Expected challenges include missing data, schema differences, and API limits.
Production would need monitoring and transient-failure retries.

The demo has no user login: the dashboard and API are public unless hosting
protection is enabled. I would add authentication and authorization before
exposing customer data. Use only test records.
