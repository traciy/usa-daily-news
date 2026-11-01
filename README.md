# USA Daily News

This repository contains the USA Daily News website and its Cloudflare Worker.

## Deploying to Cloudflare

The GitHub Actions workflow at `.github/workflows/deploy-cloudflare.yml` builds the website, installs the football-data.org API key as a Cloudflare Worker secret, and deploys the Worker and static website.

### One-time GitHub setup

In GitHub, open **Settings → Secrets and variables → Actions → New repository secret** and add these three secrets:

| Secret name | Value |
| | |
| `CLOUDFLARE_API_TOKEN` | A Cloudflare API token with permission to deploy Workers and edit Worker secrets for this account |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `FOOTBALL_DATA_API_KEY` | Your private API key from football-data.org |

Do not put these values in source code, commit them to the repository, or share them in chat.

After saving the secrets, open **Actions → Deploy USA Daily News to Cloudflare → Run workflow**. Future pushes to `main` will deploy automatically.

The deployment uses the existing `wrangler.jsonc` configuration and keeps the football API key on the server. The browser calls the same-origin `/api/football` route; it never receives the key.
