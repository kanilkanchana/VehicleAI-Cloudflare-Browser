# VehicleAI V10 — Final Cloudflare Browser Edition

**V7-inspired UI + stabilized vehicle classification + on-device YOLO26.**

Start with **[FINAL-INSTALL-GITHUB-CLOUDFLARE-SINHALA.md](FINAL-INSTALL-GITHUB-CLOUDFLARE-SINHALA.md)**. Extract into a new `VehicleAI-Cloudflare-V10` directory. Do **not** overwrite V7 or V8. Keep your already exported V8 `public/models/yolo26n.onnx`; copy it using `scripts/copy_model_from_v8.bat` (or re-export with `scripts/prepare_model.bat`). This ZIP does **not** contain model weights, Google secrets, a live deployment or real-video accuracy measurements.

## Improvements in this build

- **Full Screen** mode (native browser Fullscreen API) for monitoring: Original Video top-left, Live AI Preview bottom-left, full-height Vehicle Counts panel at right, with a Close button and Esc support. It reuses the existing video/canvas/statistics elements without interrupting the detection pipeline. Supports compact mobile fallback.


- V7-style spacious hero, original+AI video side-by-side, right sticky statistics, purple dark/light theme, About and How It Works. V10.1 adds a readable animated analysis status monitor with actual processed-frame counters, frame time, and live/sequential status, plus clear YouTube unsupported guidance.
- Numeric COCO class IDs preferred over conflicting text metadata, motion-and-size-based track matching, multi-frame label voting and post-crossing event label revision.
- `Needs type review` indicator and explicit correction of active or recorded vehicles (Van is **manual-only**, not a pretrained class).
- Letterbox-aligned counting line and responsive mobile layout.
- Browser AI real predictions, local video/camera, CORS-enabled direct URLs, consented visitor sessions in D1, optional Gmail thank-you email, CSV and feedback, plus developer Jupyter notebook.
- Improved playback controls: 0.5× default for video clips (0.25×/0.75×/1× selectable) and detailed 10-steps/sec sequential scan. Recent weighted class votes reduce momentary label changes; short-lived/low-confidence Bus/Truck observations are flagged for manual review. Van remains a manual correction, not an automatically detectable class.

**No algorithm can guarantee a van/bus/truck label is correct from pretrained COCO YOLO26n**. A custom labeled/validated Sri Lankan vehicle dataset is needed for a dependable Van class. Reported counts are estimates, based on observed detections and tracking; no fake examples.

**Deployment status:** Source prepared and tested with automated unit tests and static browser layout screenshots; not deployed or live-inference-verified here. Cloudflare Pages and Gmail require your separate setup. For full instructions and limitations see the V10 guide.

---

# VehicleAI V8 — Free Cloudflare Browser Edition

**Separate website edition of the V7 FastAPI app.** V7 stays unchanged. This edition uses the official `@ultralytics/yolo` browser library to run YOLO26 ONNX **on the visitor's device**; Cloudflare Pages Functions + D1 store visitor consent/session, feedback and aggregate counts. Uploaded video bytes are **never sent to the server**.

## What works, with setup

- Actual YOLO26 object detection on uploaded/local MP4/WebM and secure browser camera. Canvas draws YOLO bounding boxes and labels. No fake detections.
- Lightweight sampled-frame matching and counting line crossings; shows visible-now separately from counted crossings. No claim that this reproduces Python ByteTrack or accurately processes all frames in real time.
- Separate sequential timeline scan with selectable time steps/sec, 15-minute maximum (browser seek accuracy and performance vary). It is NOT a guarantee of decoding every original frame.
- Direct HTTPS MP4/webm URLs **only if CORS allows browser frame reading**. YouTube watch links are **not supported for AI analysis**; upload a local file you own or have permission to use.
- Dark/light themes, responsive layout, side statistics, line slider, CSV export, report saving and feedback.
- D1-backed email access gate with 365-day rolling HttpOnly cookie; same browser doesn't re-enter email until cookie expires/cleared. This does not verify email ownership.
- Gmail OAuth welcome/owner notification if all encrypted Cloudflare secrets are provided. OAuth Testing refresh tokens may expire in 7 days; production configuration must be handled before relying on long-term sending.
- A runnable Python ML explanation notebook for the developer, NOT hosted publicly by the Pages web root.

## Critical: first create the ONNX model

**No model binary is included in the archive.** From this folder on Windows with Anaconda `vehicle-ai` activated, run:

```bat
scripts\prepare_model.bat
```

Then confirm `public/models/yolo26n.onnx` exists and is **under Cloudflare Pages' 25 MiB per-file limit**. Do not claim the AI works until you've loaded this file in the live site and verified detections on a known traffic video. Browser performance depends on visitors' GPU/CPU. Also comply with [Ultralytics license terms](https://www.ultralytics.com/license).

## Cloudflare free deployment

See [`CLOUDFLARE-SETUP-SINHALA.md`](CLOUDFLARE-SETUP-SINHALA.md). Choose a Pages Git integration and root directory `cloudflare-v8` (recommended when adding this as a subfolder to the existing VehicleAI repository) with build output `public`. Add Cloudflare D1 binding **DB** and execute `schema.sql`. Do not put Google OAuth secrets in GitHub.

## Copy into your existing repository safely

After extracting this archive, run `scripts\install_into_repo.bat` on Windows. It only creates/updates the `cloudflare-v8` subfolder of your existing Git repository; it does **not** overwrite the FastAPI V7 files. Then export the ONNX model **from that new subfolder**.

## GitHub workflow

```bat
cd /d "C:\Users\Kanil Kanchana\OneDrive\Documents\projects\Vehical AI\vehicle-ai-traffic-monitor"
rem Copy this archive's files into cloudflare-v8\ (new folder) first, then run:
git add cloudflare-v8
git status
git commit -m "Add free browser AI Cloudflare edition"
git push origin main
```

Check that `.env`, `.dev.vars`, `gmail_token.json`, `google_oauth_client.json`, `data/` are not tracked before pushing. The existing V7 backend continues to live in its original repository folders.

## Functional limitations and security

- Counts are **estimates based on actual sampled predictions**, not guaranteed accurate in congested traffic; occlusion and tracker ID switches can affect results.
- Local video never leaves browser; 30-min local object URL release and tab close eliminate this app's references to it; a file still exists on the user's own device until the user deletes it. Report summary is persisted in D1 only on user action.
- Email-entry is not Google Sign-In or OTP authentication and cannot prove the visitor owns the address. Abuse controls are basic IP-hour rate limits; consider Turnstile/verification before a large public launch.
- Cloudflare limits, file-size cap and fair use apply; free isn't a guaranteed unlimited production platform.
- Gmail API delivery depends on secret setup, OAuth app publishing state and spam filters. No deliverability guarantee.
- `@ultralytics/yolo` loads runtime components from external CDN (`esm.sh`, underlying WASM CDN). It needs internet on initial visit; local model file is served from your site.
- Source is on GitHub; public deployment does not hide client-side JavaScript. This website hides Python notebook/source snippets from its interface, not from an intentionally public repository.

## Testing

```bash
node --test tests/*.test.mjs
python -m http.server 8080 --directory public
```

A plain static HTTP server will show the UI but the email gate needs Cloudflare Functions/D1. To test the complete site, use Wrangler Pages dev or deploy to Cloudflare as described in the guide.
