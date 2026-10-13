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
```

Replace the example URL with your Salesforce instance URL. For local development,
set it in `.env.local`, which is ignored by Git. `.env.example` is a safe template
for the repository. This is a server-side variable; do not add a `NEXT_PUBLIC_`
prefix or put credentials in the URL.

## Deployment

GitHub → Vercel

In Vercel, open Project Settings → Environment Variables and add:

- Name: `SALESFORCE_INSTANCE_URL`
- Value: `https://my-org.my.salesforce.com` (replace with your actual instance URL)
- Environments: Production and Preview; Development if using Vercel locally.

Redeploy after saving the variable. Committing `.env.example` does not configure
Vercel environment variables automatically. The API currently returns mock data;
this variable alone does not establish a Salesforce connection.

## Future Salesforce Integration

Replace mock data with Salesforce REST API.