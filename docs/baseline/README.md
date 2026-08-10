# Visual record

Captured with Playwright at a 1440×900 viewport.

## The regression baseline

**`nextjs-esl-dashboard-GEIST.png` and `nextjs-ielts-dashboard-GEIST.png` are
the baseline.** They are the first screenshots of this application rendering
with its intended typography, taken after the Phase 1a toolchain swap.

Compare future changes against these.

## Why the earlier shots are not the baseline

`baseline-vinext-esl-dashboard-ARIAL-FALLBACK.png` shows the app under the
original Vinext/Cloudflare toolchain. The exported `.vinext/fonts/*/style.css`
hard-coded the ChatGPT Sites build machine's absolute path:

```
src: url(/workspace/scratch/dc4358463e51/sites/teacher-os/.vinext/fonts/geist-ff2310f5.woff2)
```

Geist therefore 404'd on every load — 11 console errors per page — and the app
silently fell back to Arial. Any baseline captured then would have permanently
baked the wrong font into every future comparison.

Moving to `next/font/google` repaired it: Geist is now self-hosted and served
from a correct relative path, and the console is clean.

## Contents

| File | What it shows |
| --- | --- |
| `nextjs-esl-dashboard-GEIST.png` | **Baseline.** ESL dashboard on Next.js with Geist loaded. |
| `nextjs-ielts-dashboard-GEIST.png` | **Baseline.** IELTS dashboard, confirming the two workspaces stay visually distinct — violet against ESL mint. |
| `triage-esl-dashboard.png` | The triage rebuild, before the toolchain swap (Arial). |
| `triage-ielts-dashboard.png` | Same, IELTS track. |
| `triage-create-modal-honest-failure.png` | The create modal reporting that nothing was stored, rather than claiming success. |
| `after-erase-esl-dashboard.png` | Immediately after the demo data was removed, before the dashboard became triage. |
| `after-erase-ielts-writing.png` | IELTS Writing Tracker at that same point. |
| `baseline-vinext-esl-dashboard-ARIAL-FALLBACK.png` | The original export, demo data present, wrong font. Historical reference only. |

## Extending the baseline

Only the two dashboards are captured. There are 31 reachable states in total
(15 areas in ESL, 16 in IELTS). Capturing the rest is a scripted job — add
Playwright as a dev dependency and iterate over `?track=…&view=…` — and is worth
doing before any large refactor of the area components.
