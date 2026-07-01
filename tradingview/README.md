# GexLab - TradingView Auto-Sync userscript

`gexlab-sync.user.js` auto-fills the **GexLab Levels** Pine indicator's settings
with live levels from the Railway backend whenever you open the indicator's
settings dialog on TradingView. It also shows a small live-levels panel in the
bottom-right corner of the chart.

## What it does

- Detects the active chart symbol (SPY or QQQ) from the tab title / URL.
- Fetches `/api/metrics/analytics/<ticker>` (aggregated levels) and
  `/api/metrics/bridge/<ticker>` (per-DTE bridge payload) from Railway.
- When you open the GexLab Levels settings, it fills:
  - **Gamma Flip, Call Wall, Put Wall, Max Pain, Vanna Peak** (aggregated levels)
  - **Bridge Payload** (0/1/7/14/30/45 DTE walls + flips)
  - then clicks **OK** to save so the values persist across refreshes.

## Install / update

Tampermonkey is required (browser extension).

1. Open the Tampermonkey **Dashboard** -> your **GexLab - TradingView Auto-Sync**
   script (or create a new script and paste the file).
2. Select all (`Ctrl+A`), delete, paste the full contents of
   `gexlab-sync.user.js`, then **`Ctrl+S`** to save.
3. **Hard-refresh the TradingView tab (`Ctrl+Shift+R`).** Saving alone does NOT
   reload the running script - the page must reload.
4. The **GexLab Sync** panel should appear bottom-right. Double-click the
   GexLab Levels indicator to open its settings; the fields auto-fill and the
   dialog saves itself. The panel shows `filled 5/5` on success.

`@updateURL` / `@downloadURL` point at the raw GitHub file, so once installed you
can also use Tampermonkey's **Check for updates** after the `@version` is bumped.

## Hard-won gotchas (do not relearn these)

These cost a long debugging session. Keep them in mind before "fixing" anything.

### 1. Keep the file 100% ASCII

Fancy characters (em-dash, middle-dot, ellipsis, box-drawing `---` lines) get
**mangled during copy-paste** into the Tampermonkey editor, producing
`Uncaught SyntaxError: ... Unexpected identifier` and the whole script fails to
load (no panel appears). The file is deliberately ASCII-only. Verify with:

```
grep -nP '[^\x00-\x7F]' tradingview/gexlab-sync.user.js   # must print nothing
node --check tradingview/gexlab-sync.user.js              # must say nothing / exit 0
```

### 2. Detect the dialog by VISIBLE fields, not DOM existence

TradingView **leaves the settings dialog's field elements in the DOM after the
dialog closes**, collapsed to zero size. An existence check (`querySelector`)
latches onto those stale hidden fields, marks them "filled", and then never
re-fires when the dialog actually opens. The script therefore detects an open
dialog only when fields are **visible** (`getBoundingClientRect()` width/height
> 0). See `getVisibleFields()` / `getGexDialogFields()`.

### 3. The settings fields are bare `<input data-qa-id="ui-lib-Input-input">`

- They have **no `type` attribute** (so `input[type="number"]` /
  `input[type="text"]` selectors silently miss them).
- Labels and inputs live in **separate grid columns**, so walking the DOM from an
  input never reaches its own label. Label-text matching is unreliable.
- The fix: select by `data-qa-id="ui-lib-Input-input"` (+ `textarea`), take the
  **visible** ones, sort by vertical position, and map by fixed field order. The
  **Bridge Payload** field is identified by its value containing `d0cw`, which
  both confirms it is the GexLab dialog and anchors the numeric field order.

### 4. The dialog closes on focus loss

Clicking into the DevTools console closes the TradingView dialog, so manual
console inspection of the open dialog comes up empty. Use a delayed snippet
(`setTimeout(..., 5000)` then open the dialog) to inspect it. The userscript
itself never steals focus (it uses the native value setter + input/change
events), so its auto-fill works fine while the dialog is open.

### 5. React controlled inputs need the native setter

Setting `el.value` directly does not update React's state. Use the native
prototype setter and dispatch bubbling `input` + `change` events - see
`setReactValue()`.

## Related

- Pine indicator: `../GexLab_Levels.pine` (the `indicator("GexLab Levels", ...)`
  script the userscript fills). The Pine file name in TradingView may differ
  (e.g. "GexLab v2 CBOE"); the indicator TITLE is what matters.
- Backend bridge payload: `../backend/services/analytics/bridge.py`
  (`generate_tv_payload`) emits ETF-space per-DTE packs for 0/1/7/14/30/45 DTE.
