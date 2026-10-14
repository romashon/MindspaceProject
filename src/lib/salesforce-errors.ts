export const salesforceErrorMessages = {
  SALESFORCE_UNAVAILABLE: "Could not load Salesforce contracts. Check credentials, field access, and EUR currency settings.",
  SALESFORCE_TOKEN_EXPIRED: "Salesforce rejected the access token. Check OAuth policies, or replace a manually configured token.",
  SALESFORCE_AUTH_FAILED: "Salesforce OAuth authentication failed. Check Client ID/Secret, My Domain, Client Credentials Flow, and the approved Run As user.",
  SALESFORCE_CONFIGURATION_ERROR: "Salesforce configuration is invalid or missing. Check instance URL, token, API version, and currency mode, then restart the server.",
  SALESFORCE_NETWORK_ERROR: "The Node.js server cannot reach Salesforce. Check network access, VPN, firewall, and the approved proxy configuration.",
  SALESFORCE_TLS_ERROR: "Node.js could not verify Salesforce's TLS certificate. Use an approved corporate CA configuration; do not disable TLS verification.",
  SALESFORCE_TIMEOUT: "The Salesforce request timed out. Check network and proxy access, then retry.",
  SALESFORCE_PROXY_ERROR: "The proxy requires authentication or rejected the Salesforce request. Check the approved proxy configuration.",
  SALESFORCE_INVALID_FIELD: "Salesforce rejected a queried field. Check custom field API names, Account relationship, and Run As field access.",
  SALESFORCE_INVALID_OBJECT: "Salesforce rejected Workspace_Contract__c. Check object API name, deployment status, org, and Run As access.",
  SALESFORCE_ACCESS_DENIED: "Salesforce denied API access. Check Run As permissions, API Enabled, sharing, and IP restrictions.",
  SALESFORCE_RATE_LIMITED: "Salesforce API limits were reached. Check org API usage before retrying.",
  SALESFORCE_CURRENCY_MISMATCH: "Revenue must be in EUR. Check SALESFORCE_REVENUE_CURRENCY and the CurrencyIsoCode of each contract; currency conversion is not implemented.",
  SALESFORCE_INVALID_RECORD: "A Salesforce contract has missing or invalid values. Check Account, location, positive whole desk count, nonnegative revenue, and end date.",
  SALESFORCE_INVALID_RESPONSE: "Salesforce returned an unexpected response or pagination cursor. Check API version and network intermediaries.",
  SALESFORCE_API_ERROR: "Salesforce rejected the request. Check the API version and org status; no upstream details are exposed.",
} as const;

export type SalesforceErrorCode = keyof typeof salesforceErrorMessages;