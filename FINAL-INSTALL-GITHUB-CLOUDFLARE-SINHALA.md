# VehicleAI V10 — Final Browser AI build (Windows / GitHub / Cloudflare)

## What V10 fixes

- Rebuilds the roomy VehicleAI V7-inspired dashboard (hero, purple/dark theme, dual large video panels, right-hand sticky statistics, About Me, How It Works and Feedback).
- Uses numeric COCO IDs as the class mapping when present (car=2, motorcycle=3, bus=5, truck=7, bicycle=1); a disagreement with textual `name` is flagged for review.
- Tracks vehicle boxes across frames using geometry and size, independent of fluctuating class labels. Class voting is stabilized across frames and later reliable observations can revise the event's provisional label.
- Shows `Needs type review`, allowing a visible box or recorded crossing to be corrected as Car, Van (manual), Motorcycle, Bus, Truck or Bicycle.
- Aligns the original video counting line with the visible video pixels (accounts for letterboxing), and fixes mobile video cards overflowing narrow screens.
- Retains D1 visitor sessions, feedback, email gate, optional Gmail OAuth email, local-file-only video processing, dark/light switch and Jupyter notebook.

## VERY IMPORTANT: what isn't solved by JavaScript

**COCO does not have `van` as a separate class.** A pretrained YOLO26n model can still predict a van as bus, truck as bus or bus as car, especially from above and at low resolution. Voting reduces flip-flopping and the review UI allows correction, but it does not make the base model magically accurate. To reliably separate Sri Lankan vans, buses and trucks, curate annotated data for these classes, train/evaluate a custom YOLO detector, then export the custom model to ONNX. The notebook describes evaluation/training without claiming it has been done.

The browser uses lightweight **sampled** tracking and timeline seeking; this is **not V7 Python ByteTrack** and is not a promise to decode every actual video frame. Offline 2/5/10/25 samples per second are available; speed depends on visitor GPU/CPU. YouTube is watch-only; direct media URLs must allow CORS.

## 1. Keep the original projects safe

Keep:
- `...\Vehical AI\vehicle-ai-traffic-monitor\` (V7 Python) — do not overwrite
- `...\Vehical AI\VehicleAI-Cloudflare-V8\` (working V8/V9, local config and exported ONNX)

Extract this ZIP to a **separate** folder:

`C:\Users\Kanil Kanchana\OneDrive\Documents\projects\Vehical AI\VehicleAI-Cloudflare-V10`

If ZIP extracts into a top-level `VehicleAI-V10-Final-Cloudflare` folder, move its *contents* into that destination.

## 2. Bring your model and local Wrangler config from V8

Open Windows CMD:

```bat
cd /d "C:\Users\Kanil Kanchana\OneDrive\Documents\projects\Vehical AI\VehicleAI-Cloudflare-V10"
copy "..\VehicleAI-Cloudflare-V8\public\models\yolo26n.onnx" "public\models\yolo26n.onnx"
copy "..\VehicleAI-Cloudflare-V8\wrangler.toml" "wrangler.toml"
```

If you have `.dev.vars`, you may copy it manually for **local testing only**. Never commit `.dev.vars`, OAuth JSON, `gmail_token.json` or your Windows `.vehicleai` folder to GitHub. The V10 ZIP intentionally contains **no ONNX weights or secrets**.

Model check:

```bat
dir public\models\yolo26n.onnx
```

It should be about 9.5 MiB. If V8 model file is missing, activate conda `vehicle-ai`, then run `scripts\prepare_model.bat` to export a new model.

## 3. Run backend + UI locally (NOT python http.server)

```bat
npx wrangler d1 execute vehicleai-local --local --file=./schema.sql
npx wrangler pages dev public --port 8788
```

If local DB schema was already initialized and migration complains `table already exists`, **do not delete your existing local DB**. Skip the `d1 execute` line and run Pages dev. Your `wrangler.toml` must have D1 binding named `DB`; for the initial local setup use the original V8 `wrangler.toml`.

Open `http://127.0.0.1:8788/api/health`, expect `database:true`. Open `http://127.0.0.1:8788/`, enter an email and consent. `gmail:false` means the local Gmail secrets are not configured, not that detection is broken.

Once inside, upload the test MP4, **Play** (sampled live AI), or choose **Sequential analyze** to scan the timeline. Watch boxes, review questionable types, line crossings, saved summary and CSV.

## 4. Unit checks

```bat
node --test
```

## 5. GitHub — create a SECOND repository

Recommended new repository: `VehicleAI-Cloudflare-Browser` (private at first). Create it at `https://github.com/new` without README, license or generated gitignore. In V10 folder:

```bat
git init
 git branch -M main
 git add .
 git status
 git ls-files | findstr /i "gmail_token google_oauth_client client_secret .dev.vars wrangler.toml .env"
 git commit -m "VehicleAI V10 browser AI final release"
 git remote add origin https://github.com/kanilkanchana/VehicleAI-Cloudflare-Browser.git
 git push -u origin main
```

The `git ls-files | findstr` command should not print secrets/config files. `public/models/yolo26n.onnx` **must** appear in `git ls-files` so Cloudflare can serve the model. If any private files appear, stop before pushing.

If the repository is already initialized, don't run `git init`/`remote add`; use `git remote -v` and `git remote set-url origin ...` if necessary.

## 6. Cloudflare Pages (static + Functions + D1)

- Cloudflare Dashboard > Workers & Pages > Pages > Connect to Git.
- Select repository `VehicleAI-Cloudflare-Browser` / branch `main`.
- Framework preset `None`, build command empty, build output directory `public`, root directory `.`.
- D1: create `vehicleai-db` and bind **variable `DB`** to it under Pages Settings > Bindings (Production and Preview as appropriate).
- Apply `schema.sql` to your **remote production D1** in Cloudflare dashboard or CLI.
- Set sender/owner Gmail secrets using your **own local** `scripts/setup_cloudflare_gmail.py` once configured. Never expose Google refresh tokens to the website's frontend or GitHub. Gmail OAuth Testing mode tokens may expire and are not reliable for production until properly configured.
- Redeploy and verify `/api/health` returns `database:true` and that the ONNX file loads from `/models/yolo26n.onnx`.

Use the existing `CLOUDFLARE-SETUP-SINHALA.md` for detailed D1/Gmail setup, but for this V10 *separate-repository* installation use **root `.`**, not the old subfolder `cloudflare-v8`.

## 7. Production limitations before sharing widely

- The email entry is not verification (anyone can type an address), so it is not suitable for sensitive or private data.
- Only report totals, feedback, email and sessions are stored in D1; visitor video stays on-device. The browser object URL is released after 30 min or when page closes. This doesn't delete the visitor's own file.
- External JS/WASM runtime and CSS fonts require internet access. The model weight is served from Pages.
- In crowded traffic, even the updated tracking logic can miss/reassign vehicle identities. Compare with manual counts before publishing accuracy statements.
- Browser tests were limited to a **static visual layout render** due to automated browser network restrictions. No real Windows browser ONNX inference or Cloudflare production deployment was performed here.
- Ultralytics model/runtime licensing applies. Check before commercial deployment.
