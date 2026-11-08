# VehicleAI V8 — Cloudflare FREE Hosting Guide (Sinhala / English)

**Result:** `https://YOUR-PROJECT.pages.dev` — PC OFF කළත් static website online. Vehicle detection visitorගේ browser එකේ run වෙනවා, වෙන server එකක Python YOLO run කරන්න අවශ්‍ය නැහැ.

## Step 1 — Copy V8 into your existing GitHub project

Windows CMD / PowerShell: unzip V8 and copy the **contents** of `VehicleAI-V8-Cloudflare-Edition` to this new folder:

`C:\Users\Kanil Kanchana\OneDrive\Documents\projects\Vehical AI\vehicle-ai-traffic-monitor\cloudflare-v8\`

Original FastAPI V7 files delete/overwrite කරන්න එපා. Final structure:

```
vehicle-ai-traffic-monitor/
  app/                       (old V7 Python app)
  cloudflare-v8/
    public/index.html
    public/app.js
    public/style.css
    public/tracker.mjs
    public/assets/vehicleai-logo.webp
    public/models/yolo26n.onnx   <-- create in Step 2
    functions/api/session.js
    functions/api/feedback.js
    functions/api/report.js
    functions/api/health.js
    functions/lib/...
    schema.sql
    README.md
  ...
```

## Step 2 — Model export (required, no fake detection)

Activate your existing Conda environment, then:

```bat
conda activate vehicle-ai
cd /d "C:\Users\Kanil Kanchana\OneDrive\Documents\projects\Vehical AI\vehicle-ai-traffic-monitor\cloudflare-v8"
scripts\prepare_model.bat
```

This downloads original pretrained YOLO26 weights, converts ONNX for browser and saves `public/models/yolo26n.onnx`. Can take time; large dependencies download once. **Confirm under 25 MiB** (Cloudflare Pages maximum). Review Ultralytics AGPL/enterprise license obligations if making a public service.

## Step 3 — GitHub push

In **original project root**, NOT inside your Windows user home:

```bat
cd /d "C:\Users\Kanil Kanchana\OneDrive\Documents\projects\Vehical AI\vehicle-ai-traffic-monitor"
git status
git add cloudflare-v8
git diff --cached --name-only
git commit -m "VehicleAI V8 Cloudflare browser AI edition"
git push origin main
```

Check no .env, *.token, OAuth JSON, .dev.vars, credentials or `data/` in staged files.

## Step 4 — Cloudflare Pages (Free)

1. Open https://dash.cloudflare.com/ and sign up/login.
2. Go **Workers & Pages → Create → Pages → Connect to Git**. Select private GitHub repo `kanilkanchana/VehicleAI-Traffic-Intelligence` and `main` branch. (UI names may vary.)
3. Project name e.g. `vehicleai-browser`. Framework preset **None**.
4. **Root directory:** `cloudflare-v8`
5. **Build command:** blank or `exit 0`.
6. **Build output directory:** `public`.
7. Click **Save and Deploy**. First deployment may show an email gate setup error until D1 is bound.
8. URL becomes `https://vehicleai-browser.pages.dev` **if the name is available**; use actual URL given by Cloudflare.

Docs: https://developers.cloudflare.com/pages/get-started/git-integration/

## Step 5 — D1 Database (required for email gate/feedback)

1. In Cloudflare dashboard open **Workers & Pages → D1 → Create database**. Name: `vehicleai-db`.
2. Open database **Console** and paste/execute the content of `schema.sql` (six CREATE TABLE/INDEX statements). Or use Wrangler: `npx wrangler d1 execute vehicleai-db --remote --file=cloudflare-v8/schema.sql` from repository root after `npx wrangler login`.
3. Open **Workers & Pages → your Pages project → Settings → Bindings → Add → D1 Database**.
4. Binding variable name **EXACTLY `DB`**, select `vehicleai-db`.
5. **Redeploy** Pages (Bindings are applied to new deployments).
6. Verify `https://YOUR.pages.dev/api/health` reports `database:true`.

Docs: https://developers.cloudflare.com/pages/functions/bindings/

## Step 6 — Gmail API (optional but needed for thank-you email)

Your Windows OAuth test used two files **outside repo**:

```
%USERPROFILE%\.vehicleai\google_oauth_client.json
%USERPROFILE%\.vehicleai\gmail_token.json
```

Cloudflare Pages project → **Settings → Variables and Secrets** → add encrypted **secrets**:

- `GMAIL_CLIENT_ID` — from `google_oauth_client.json` under `installed.client_id`
- `GMAIL_CLIENT_SECRET` — from `installed.client_secret`
- `GMAIL_REFRESH_TOKEN` — from `gmail_token.json` field `refresh_token`
- `SENDER_EMAIL` — Gmail account you authorized
- `OWNER_EMAIL` — email for owner notifications

**Never paste secret values into GitHub, chat, logs or screenshots**. For easier secure setup, from `cloudflare-v8` run `npx wrangler login` then `python scripts/setup_cloudflare_gmail.py` (requires Node/npx and that Pages project exists). That script supplies secret values through standard input rather than printing them. Redeploy after setting secrets.

**Important:** The OAuth app was set to **Testing**. Gmail API refresh token may expire in ~7 days. Long-term reliable emails require reviewing Google's OAuth publishing and verification requirements; GitHub/Cloudflare alone does not solve this. This email-entry gate does not verify visitor email ownership.

## Step 7 — Real acceptance test

1. New/incognito browser: email gate → consent → Continue → site loads (D1 saves visitor). Email welcome sent **only if Gmail secrets work**.
2. Reload same browser → no email prompt. Clear cookies or use another browser → gate appears again.
3. Upload one real short MP4 → Play → status should say real YOLO loaded; boxes appear in AI Preview. The line crossing count only increments after a tracked crossing.
4. For detailed analysis pause and press Sequential analyze → progress reaches 100%. This scans video timeline at configurable steps/sec, not guaranteed exact every-frame decode.
5. Use live webcam on HTTPS, approve camera access.
6. Save summary to D1, download CSV, submit feedback.
7. Check no raw MP4 was transmitted in browser Network → only session/report/feedback JSON requests should be sent to your API.
8. YouTube links preview only; external video URL analysis requires CORS.

## Cost and constraints

Cloudflare Pages static hosting and a small amount of Pages Functions/D1 usage are available at **Free-tier limits**, not unlimited use. Model must fit the 25 MiB static file cap, browser needs WebGPU or slower CPU fallback. High visitor traffic or storage could exceed free quotas.

## Local dev (optional advanced)

With Node.js and Wrangler, after D1 create, use `npx wrangler pages dev public --d1 DB=<DATABASE_ID>` and `npx wrangler d1 execute vehicleai-db --local --file=schema.sql` as needed. Check current Wrangler flag syntax if it changes. For most beginners Cloudflare deployment + remote D1 is simpler.

## Reminder

The original `vehicle-ai-traffic-monitor` Python backend (V7) remains an independent development branch. This **browser edition is new code**, not a Python server hosted on GitHub Pages.
