// ==UserScript==
// @name         GexLab - TradingView Auto-Sync
// @namespace    https://gexlab.app
// @version      1.8.0
// @description  Automatically fills GexLab key levels into the GexLab Levels indicator when you open its settings. Shows a live levels panel in the corner.
// @author       GexLab
// @updateURL    https://raw.githubusercontent.com/vansummers/gexlab/main/tradingview/gexlab-sync.user.js
// @downloadURL  https://raw.githubusercontent.com/vansummers/gexlab/main/tradingview/gexlab-sync.user.js
// @match        https://www.tradingview.com/*
// @grant        GM_xmlhttpRequest
// @connect      gexlab-production.up.railway.app
// ==/UserScript==

(function () {
    'use strict';

    const API          = 'https://gexlab-production.up.railway.app';
    const INDICATOR    = 'GexLab Levels';   // must match indicator("...") in Pine
    const REFRESH_MS   = 60000;             // re-fetch every 60 seconds
    const TICKERS      = ['SPY', 'QQQ'];    // tickers the backend tracks
    const DEFAULT_TICKER = 'SPY';

    let levels    = null;   // analytics.levels from Railway
    let bridge    = null;   // bridge payload string from Railway
    let lastFetch = null;
    let panel     = null;
    let ticker    = DEFAULT_TICKER;   // active chart symbol, kept in sync
    let fillStatus = '';    // last dialog-fill result, shown in the panel

    // --- Symbol Detection ---

    // Detect which tracked ticker the chart is currently showing. The tab title
    // updates live on symbol change ("SPY 746.77 ..."), so prefer it, then fall
    // back to the ?symbol= URL param. Only SPY/QQQ are tracked by the backend.
    function detectTicker() {
        const haystacks = [
            document.title || '',
            new URLSearchParams(location.search).get('symbol') || '',
        ];
        for (const hay of haystacks) {
            const up = hay.toUpperCase();
            for (const t of TICKERS) {
                if (new RegExp('\\b' + t + '\\b').test(up)) return t;
            }
        }
        return DEFAULT_TICKER;
    }

    // --- Railway Fetching ---

    function apiFetch(path, cb) {
        GM_xmlhttpRequest({
            method : 'GET',
            url    : API + path,
            onload : r => { try { if (r.status === 200) cb(JSON.parse(r.responseText)); } catch (_) {} },
            onerror: () => {},
        });
    }

    function refresh() {
        ticker = detectTicker();
        apiFetch('/api/metrics/analytics/' + ticker, data => {
            levels    = data.levels || null;
            lastFetch = new Date();
            renderPanel();
        });
        apiFetch('/api/metrics/bridge/' + ticker, data => {
            bridge = data.payload || null;
        });
    }

    // --- React Input Helpers ---

    // TradingView uses React controlled inputs. To update them we must use the
    // native setter so React picks up the change via its synthetic event system.
    function setReactValue(el, value) {
        const proto  = el.tagName === 'TEXTAREA'
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, String(value));
        el.dispatchEvent(new Event('input',  { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // TradingView tags every settings input (numeric fields AND the Bridge
    // Payload string field) with data-qa-id="ui-lib-Input-input". Checkboxes use
    // a different qa-id, so this selector matches only the fields we fill.
    const FIELD_SELECTOR = 'input[data-qa-id="ui-lib-Input-input"], textarea';

    // Return the currently VISIBLE settings fields, sorted top-to-bottom.
    // Visibility is the key: TradingView leaves the dialog's field elements in the
    // DOM after it closes but collapses them to zero size, so an existence check
    // would latch onto stale hidden fields. Only visible fields mean a real open
    // dialog.
    function getVisibleFields() {
        return [...document.querySelectorAll(FIELD_SELECTOR)]
            .filter(el => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            })
            .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    }

    // Identify an open GexLab Levels dialog by its Bridge Payload field, whose
    // value is the compact JSON containing "d0cw" (true before and after we fill
    // it). This both confirms the dialog is ours and locates the string field so
    // the five numeric fields map cleanly. Returns { fields, bridgeIdx } or null.
    function getGexDialogFields() {
        const fields = getVisibleFields();
        if (!fields.length) return null;
        const bridgeIdx = fields.findIndex(el => {
            const v = (el.value || '').trim();
            return v.includes('d0cw') || v.startsWith('{');
        });
        if (bridgeIdx === -1) return null;   // not the GexLab dialog
        return { fields, bridgeIdx };
    }

    // --- Dialog Fill ---

    function fillFields() {
        if (!levels && !bridge) {
            console.warn('[GexLab] No data yet - try clicking Sync Now in the panel.');
            return;
        }

        const gex = getGexDialogFields();
        if (!gex) { console.warn('[GexLab] Fields vanished before fill.'); return; }

        // Field order (by vertical position):
        //   bridgeIdx -> Bridge Payload
        //   remaining -> Gamma Flip, Call Wall, Put Wall, Max Pain, Vanna Peak
        const numeric = gex.fields.filter((_, i) => i !== gex.bridgeIdx);
        const floatVals = levels ? [
            ['Gamma Flip', levels.gammaFlip],
            ['Call Wall',  levels.callWall],
            ['Put Wall',   levels.putWall],
            ['Max Pain',   levels.maxPain],
            ['Vanna Peak', levels.vannaMagnet],
        ] : [];

        let filled = 0;
        floatVals.forEach((pair, i) => {
            const input = numeric[i];
            const val = pair[1];
            if (!input || val == null || isNaN(val)) return;
            setReactValue(input, Number(val).toFixed(2));
            filled++;
            console.log('[GexLab] Set "' + pair[0] + '" = ' + Number(val).toFixed(2));
        });

        if (bridge && gex.fields[gex.bridgeIdx]) {
            setReactValue(gex.fields[gex.bridgeIdx], bridge);
        }

        fillStatus = 'filled ' + filled + '/' + floatVals.length;
        renderPanel();

        // Click the dialog's OK/Apply button (visible one) to save & persist.
        setTimeout(() => {
            const buttons = [...document.querySelectorAll('button')].filter(b => {
                const r = b.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            });
            for (const btn of buttons) {
                const text = btn.textContent.trim().toLowerCase();
                if (text === 'ok' || text === 'apply') { btn.click(); return; }
            }
        }, 800);
    }

    // --- Dialog Detection ---

    // Poll every 500ms. A real open dialog is detected only when its VISIBLE
    // fields (with the GexLab bridge signature) are present. `_filled` latches so
    // we fill once per open; it resets automatically when the dialog closes and
    // the fields disappear.
    let _filled = false;
    setInterval(() => {
        if (detectTicker() !== ticker) {
            console.log('[GexLab] Symbol changed to ' + detectTicker() + ' - refetching.');
            refresh();
        }

        const gex = getGexDialogFields();

        if (!gex) { _filled = false; return; }   // dialog closed -> reset
        if (_filled) return;                      // already filled this open

        console.log('[GexLab] GexLab dialog open (' + gex.fields.length + ' fields) - filling...');
        _filled = true;
        setTimeout(fillFields, 300);
    }, 500);

    // --- Floating Panel ---

    function fmt(v) {
        return v != null && !isNaN(v) ? '$' + Number(v).toFixed(2) : '-';
    }

    function buildPanel() {
        panel = document.createElement('div');
        panel.id = 'gexlab-sync-panel';

        Object.assign(panel.style, {
            position     : 'fixed',
            bottom       : '72px',
            right        : '12px',
            zIndex       : '99999',
            background   : '#1a1d27',
            border       : '1px solid #2a2e39',
            borderRadius : '10px',
            padding      : '12px 14px',
            fontFamily   : '-apple-system, BlinkMacSystemFont, "Trebuchet MS", sans-serif',
            fontSize     : '11px',
            color        : '#d1d4dc',
            width        : '172px',
            boxShadow    : '0 8px 24px rgba(0,0,0,0.6)',
            userSelect   : 'none',
            lineHeight   : '1.5',
        });

        document.body.appendChild(panel);
        renderPanel();
    }

    function renderPanel() {
        if (!panel) return;

        const age = lastFetch
            ? Math.round((Date.now() - lastFetch) / 1000) + 's ago'
            : 'loading...';

        const status = fillStatus ? ' - ' + fillStatus : '';

        panel.innerHTML =
            '<div style="font-size:9px;font-weight:700;letter-spacing:.15em;color:#555f71;text-transform:uppercase;margin-bottom:9px">' +
                'GexLab Sync - <span style="color:#8fa0c0">' + ticker + '</span>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr auto;row-gap:3px;column-gap:8px;margin-bottom:10px">' +
                '<span style="color:#6b7280">GEX Flip</span>' +
                '<span style="color:#f0c040;font-weight:600;text-align:right">' + fmt(levels ? levels.gammaFlip : null) + '</span>' +
                '<span style="color:#6b7280">Call Wall</span>' +
                '<span style="color:#26a69a;font-weight:600;text-align:right">' + fmt(levels ? levels.callWall : null) + '</span>' +
                '<span style="color:#6b7280">Put Wall</span>' +
                '<span style="color:#ef5350;font-weight:600;text-align:right">' + fmt(levels ? levels.putWall : null) + '</span>' +
                '<span style="color:#6b7280">Max Pain</span>' +
                '<span style="color:#c9a84c;font-weight:600;text-align:right">' + fmt(levels ? levels.maxPain : null) + '</span>' +
                '<span style="color:#6b7280">Vanna</span>' +
                '<span style="color:#ab88f5;font-weight:600;text-align:right">' + fmt(levels ? levels.vannaMagnet : null) + '</span>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #2a2e39;padding-top:9px;margin-top:2px">' +
                '<span style="color:#3d4455;font-size:9px">' + age + status + '</span>' +
                '<button id="gexlab-refresh-btn" style="background:#2962ff;border:none;border-radius:5px;color:#fff;padding:3px 9px;font-size:9px;font-weight:700;cursor:pointer;letter-spacing:.05em;text-transform:uppercase">Sync Now</button>' +
            '</div>';

        document.getElementById('gexlab-refresh-btn').onclick = () => {
            refresh();
        };
    }

    // Keep the age counter ticking without a full re-fetch.
    setInterval(() => {
        if (lastFetch) renderPanel();
    }, 10000);

    // --- Init ---

    // TradingView is a SPA - wait for the app shell to mount before injecting.
    function init() {
        buildPanel();
        refresh();
        setInterval(refresh, REFRESH_MS);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
