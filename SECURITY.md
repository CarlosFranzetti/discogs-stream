# Security Policy

## Supported version

Security fixes are applied to the current default branch and the live deployment.

## Report a vulnerability

Do not open a public issue for vulnerabilities involving authentication, API keys,
Supabase data, OAuth tokens, or playback-provider credentials.

Use GitHub's private vulnerability reporting feature if it is enabled. Otherwise,
contact the repository owner through the contact method listed on the GitHub profile.

Include:

- affected page, endpoint, or component
- steps to reproduce
- expected and observed behavior
- potential impact
- screenshots or a minimal proof of concept without real credentials

Please allow reasonable time for investigation before public disclosure.

## Sensitive areas

Take extra care around:

- Discogs OAuth tokens and collection data
- Supabase authorization and row-level security
- serverless functions and environment variables
- external playback and metadata providers
- imported CSV files and user-generated metadata

## Secrets

Never commit `.env` files, access tokens, API keys, refresh tokens, service-role keys,
or production database credentials. Revoke and rotate any credential that is exposed.
