# Phase One Setup Prompt & Handoff Guide

**Status:** Ready for Phase One finalization  
**Timeline:** One-week handoff (2026-10-02 → 2026-10-09)  
**Goal:** Activate all nine Cloudflare Workers, configure GitHub Actions secrets across all repos, and transition app tiles from Render fallback to live `workers.dev` URLs.

---

## Phase One: Workers Activation & GitHub Actions Secrets

### Repos Now Ready for Deployment

The following **nine repos** have had their Worker scaffolding and deployment workflows completed:

1. **Venue IQ**
2. **Foodtruck Apollo**
3. **Restaurateur Pro**
4. **Roundtable**
5. **Geocastnet**
6. **VIBE Concierge**
7. **Foxhounds**
8. **Margin IQ** *(Python service; manual workflow until API is a Worker)*
9. **Back of House IQ** *(Python service; manual workflow until API is a Worker)*

The public site's app tiles are currently pointing to **Render as a fallback** to avoid breaking the site. Tiles will move to live `workers.dev` URLs as workflows complete.

---

## Step 1: Add GitHub Actions Secrets to Each Repo

**Each of the nine repos requires two secrets:**

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

**Do not paste these values in this document.** Retrieve them from your Cloudflare Dashboard:

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Account** → **API Tokens**
3. Create or locate your token with `workers:write` scope
4. Copy the token to a secure location
5. Get your **Account ID** from **Account** → **Overview** → right sidebar

**To add secrets to each repo:**

For each of the nine repos:
```
GitHub Repo Settings → Secrets and variables → Actions
  Add: CLOUDFLARE_API_TOKEN = <your-token>
  Add: CLOUDFLARE_ACCOUNT_ID = <your-account-id>
```

Repos to update:
- Cmooreculinary/Venue-IQ
- Cmooreculinary/Foodtruck-Apollo
- Cmooreculinary/Restaurateur-Pro
- Cmooreculinary/Roundtable
- Cmooreculinary/Geocastnet
- Cmooreculinary/VIBE-Concierge
- Cmooreculinary/Foxhounds
- Cmooreculinary/Margin-IQ
- Cmooreculinary/Back-of-House-IQ

---

## Step 2: Trigger Workflows

Once secrets are in place, trigger the GitHub Actions workflows:

1. Navigate to each repo's **Actions** tab
2. Select the deployment workflow (typically named `deploy.yml` or similar)
3. Click **Run workflow** → **Run workflow**
4. Monitor the workflow run for success (green checkmark)

**Expected outcomes:**
- Workflow runs to completion without errors
- A `workers.dev` URL is generated and/or updated in Cloudflare
- Build artifacts are deployed to your Cloudflare account

---

## Step 3: Update App Tiles on Public Site

Once a workflow turns **green**, update that app's tile on the public site:

**For each app that goes green:**
1. Locate the app tile configuration (typically in `public/` or a config file like `apps.json`)
2. Change the URL from the **Render fallback** to the **live `workers.dev` URL**
   - Example: `https://venue-iq.workers.dev`
3. Commit and deploy the public site
4. Verify the tile loads the Worker

**Currently pointing to Render (fallback):**
- Venue IQ
- Foodtruck Apollo
- Restaurateur Pro
- Roundtable
- Geocastnet
- VIBE Concierge
- Foxhounds
- Margin IQ *(static until API Worker ready)*
- Back of House IQ *(static until API Worker ready)*

---

## Step 4: Python Services (Manual Workflow)

**Margin IQ** and **Back of House IQ** are Python services with **manual workflows** until their APIs are available as Workers (not static folders):

- Run their workflows manually via **Actions** → **Run workflow** when ready
- These will not automatically deploy until the backend API is Worker-compatible
- Once ready, their tiles can point to their API endpoints instead of the static folder

---

## Repos Not Touched This Pass

The following repos did not match a scannable target and were not modified:

- **Dusk**
- **Expansion IQ**
- **Pro-Builder**

These can be added to Phase One in a follow-up pass if needed.

---

## Checklist for Phase One Completion

- [ ] **Venue IQ** — Secrets added, workflow triggered, green, tile updated
- [ ] **Foodtruck Apollo** — Secrets added, workflow triggered, green, tile updated
- [ ] **Restaurateur Pro** — Secrets added, workflow triggered, green, tile updated
- [ ] **Roundtable** — Secrets added, workflow triggered, green, tile updated
- [ ] **Geocastnet** — Secrets added, workflow triggered, green, tile updated
- [ ] **VIBE Concierge** — Secrets added, workflow triggered, green, tile updated
- [ ] **Foxhounds** — Secrets added, workflow triggered, green, tile updated
- [ ] **Margin IQ** — Secrets added, workflow manual run complete (when API ready)
- [ ] **Back of House IQ** — Secrets added, workflow manual run complete (when API ready)
- [ ] All app tiles on public site point to live `workers.dev` URLs (or Render fallback for Python services)
- [ ] Public site deployment complete and verified

---

## Troubleshooting

### Workflow fails with "Unauthorized" or "Invalid credentials"

- Verify the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets are correctly set
- Check that the token has the correct scope (`workers:write`)
- Confirm you copied the entire token (no leading/trailing spaces)

### `workers.dev` URL not generated

- Check Cloudflare Dashboard → Workers for the deployed service
- Verify the Worker name matches what the workflow is trying to deploy
- Check workflow logs for deployment errors

### App tile still points to Render after updating config

- Clear browser cache (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows/Linux)
- Verify the public site's latest commit includes the URL change
- Confirm the public site has redeployed

### Python services (Margin IQ, Back of House IQ) won't deploy

- These are manual workflows and do not auto-deploy
- The API must be converted to a Cloudflare Worker before auto-deployment can be enabled
- For now, run the workflow manually and verify output in Cloudflare Dashboard

---

## Notes for Next Week

When you return from the week away:

1. Check the status of all nine workflows (look for green/red in each repo's Actions tab)
2. Any red workflows likely need debugging — check the logs
3. Any green workflows should have their tiles moved to `workers.dev` URLs
4. The public site should be the last thing to deploy once all tiles are ready
5. Monitor the public site for 24 hours post-deployment to catch any issues

**Do not** push the public site live until at least 7 of the 9 apps are confirmed working on their `workers.dev` URLs.

---

## Quick Reference: Workers.dev URL Format

Each deployed Cloudflare Worker gets a free `workers.dev` subdomain:

```
https://<worker-name>.<account-subdomain>.workers.dev
```

Example:
```
https://venue-iq.myaccount-123.workers.dev
```

Check your Cloudflare Dashboard → Workers to see the exact URL for each deployed service.

---

## Files to Review

- **Workflow definitions:** Check each repo's `.github/workflows/` for the deployment job config
- **Wrangler config:** Look for `wrangler.toml` in the repo root or subdirectories
- **Public site config:** Find the app tiles config file (likely `public/apps.json` or similar) on the public site repo

---

**Good luck with Phase One! This should get all nine apps live on Cloudflare Workers by next week.**
