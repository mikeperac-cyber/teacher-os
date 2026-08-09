# Visual record

Captured with Playwright at a 1440×900 viewport against the Vinext dev server.

| File | What it shows |
| --- | --- |
| `baseline-vinext-esl-dashboard-ARIAL-FALLBACK.png` | The ESL dashboard **with the original demo data**, before the erasure. |
| `after-erase-esl-dashboard.png` | The same screen after the demo data was removed. Layout, spacing, theming and component structure are unchanged; every panel renders its empty state. |
| `after-erase-ielts-writing.png` | The IELTS Writing Tracker, confirming the two tracks remain visually and structurally distinct (violet vs. ESL mint) and that the four official Writing criteria survive as product copy. |

## These are not yet the regression baseline

The filename says `ARIAL-FALLBACK` for a reason. The exported
`.vinext/fonts/*/style.css` hard-codes the ChatGPT Sites build machine's
absolute path:

```
src: url(/workspace/scratch/dc4358463e51/sites/teacher-os/.vinext/fonts/geist-ff2310f5.woff2)
```

Geist therefore 404s locally (11 console errors on every page load) and the app
falls back to Arial. **These screenshots do not show the intended typography.**

Switching to `next/font/google` in Phase 1a repairs this by self-hosting Geist
from a correct relative path. The real pixel-diff baseline must be captured
*after* that swap — capturing it now would permanently bake the wrong font into
the comparison.

Until then these images serve a narrower purpose: showing that removing the demo
data changed the content and nothing else.
