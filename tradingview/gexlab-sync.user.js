// ==UserScript==
// @name         GexLab — TradingView Auto-Sync
// @namespace    https://gexlab.app
// @version      1.1.0
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
    const REFRESH_MS   = 60_000;            // re-fetch every 60 seconds

    let levels    = null;   // analytics.levels from Railway
    let bridge    = null;   // bridge payload string from Railway
    let lastFetch = null;
    let panel     = null;

    // ─── Railway Fetching ─────────────────────────────────────────────────────

    function apiFetch(path, cb) {
        GM_xmlhttpRequest({
            method : 'GET',
            url    : API + path,
            onload : r => { try { if (r.status === 200) cb(JSON.parse(r.responseText)); } catch (_) {} },
            onerror: () => {},
        });
    }

    function refresh() {
        apiFetch('/api/metrics/analytics/SPY', data => {
            levels    = data.levels ?? null;
            lastFetch = new Date();
            renderPanel();
        });
        apiFetch('/api/metrics/bridge/SPY', data => {
            bridge = data.payload ?? null;
        });
    }

    // ─── React Input Helpers ──────────────────────────────────────────────────

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

    // Find the input/textarea element whose settings row is labelled `labelText`.
    // TradingView lays out each input as:  [label div]  [input div]  side by side
    // inside a shared row container. We walk text nodes to find the label then
    // search the surrounding DOM for the closest input.
    function findInputByLabel(root, labelText) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: n =>
                n.textContent.trim() === labelText
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_SKIP,
        });

        const textNode = walker.nextNode();
        if (!textNode) return null;

        // Walk upward from the text node, checking each level and its siblings
        // for an input element.
        let el = textNode.parentElement;
        for (let depth = 0; depth < 6; depth++) {
            if (!el || el === root) break;

            // Check this element's subtree (skip if it contains our text node
            // to avoid re-finding the label itself).
            const candidate = el.querySelector(
                'input[type="number"], input[type="text"], textarea'
            );
            if (candidate) return candidate;

            // Check the next sibling's subtree — label and input are often
            // in adjacent siblings inside a row wrapper.
            const sibling = el.nextElementSibling;
            if (sibling) {
                const sibCandidate = sibling.querySelector(
                    'input[type="number"], input[type="text"], textarea'
                );
                if (sibCandidate) return sibCandidate;
            }

            el = el.parentElement;
        }
        return null;
    }

    // ─── Dialog Fill ─────────────────────────────────────────────────────────

    function fillDialog(dialog) {
        if (!levels && !bridge) {
            console.warn('[GexLab] No data yet — try clicking Sync Now in the panel.');
            return;
        }

        // Float fields: [Pine input title, value from Railway]
        const floatFields = [
            ['Gamma Flip', levels?.gammaFlip],
            ['Call Wall',  levels?.callWall],
            ['Put Wall',   levels?.putWall],
            ['Max Pain',   levels?.maxPain],
            ['Vanna Peak', levels?.vannaMagnet],
        ];

        for (const [label, val] of floatFields) {
            if (val == null || isNaN(val)) continue;
            const input = findInputByLabel(dialog, label);
            if (input) {
                setReactValue(input, val.toFixed(2));
            } else {
                console.warn(`[GexLab] Could not find input for "${label}"`);
            }
        }

        // Bridge payload string field
        if (bridge) {
            const bridgeInput = findInputByLabel(dialog, 'Bridge Payload');
            if (bridgeInput) setReactValue(bridgeInput, bridge);
        }

        // Click OK to save — wait 800ms so React has time to process the events.
        setTimeout(() => {
            const buttons = dialog.querySelectorAll('button');
            for (const btn of buttons) {
                const text = btn.textContent.trim().toLowerCase();
                if (text === 'ok' || text === 'apply') {
                    btn.click();
                    return;
                }
            }
            // Fallback: look for the primary action button by aria-label
            const primary = dialog.querySelector('[data-name="submit-button"], button[type="submit"]');
            if (primary) primary.click();
        }, 800);
    }

    // ─── Dialog Detection ─────────────────────────────────────────────────────

    // TradingView reuses the same dialog DOM node and swaps its content, so
    // MutationObserver (which watches for added nodes) misses it. Poll instead.

    function isSettingsDialog(el) {
        return (
            el.textContent?.includes(INDICATOR) &&
            el.querySelector('input[type="number"]') !== null
        );
    }

    function findOpenDialog() {
        // Locate "GexLab Levels" title text node then walk up to the container
        // that holds the input fields. TradingView's dialog uses no standard
        // role="dialog" or data-name attribute, so selector-based approaches fail.
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: n =>
                n.textContent.trim() === INDICATOR
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_SKIP,
        });
        const titleNode = walker.nextNode();
        if (!titleNode) return null;

        // Walk up until we find a container that also has number/text inputs
        let el = titleNode.parentElement;
        while (el && el !== document.body) {
            if (el.querySelector('input[type="number"], input[type="text"], textarea')) {
                return el;
            }
            el = el.parentElement;
        }
        return null;
    }

    let _lastDialog  = null;
    let _lastFilled  = null;

    function isVisible(el) {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }

    // Poll every 500ms. TradingView hides the dialog node rather than removing
    // it, so we check visibility — not just existence — to detect open/close.
    setInterval(() => {
        const dialog = findOpenDialog();

        if (!dialog || !isVisible(dialog)) {
            if (_lastFilled) {
                console.log('[GexLab] Dialog closed — resetting fill state.');
                _lastDialog = null;
                _lastFilled = null;
            }
            return;
        }

        if (dialog === _lastDialog && _lastFilled) return;

        console.log('[GexLab] Dialog opened — filling values...');
        _lastDialog = dialog;
        _lastFilled = true;
        setTimeout(() => fillDialog(dialog), 300);
    }, 500);

    // ─── Floating Panel ───────────────────────────────────────────────────────

    function fmt(v) {
        return v != null && !isNaN(v) ? '$' + Number(v).toFixed(2) : '—';
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
            : 'loading…';

        panel.innerHTML = `
            <div style="font-size:9px;font-weight:700;letter-spacing:.15em;color:#555f71;text-transform:uppercase;margin-bottom:9px">
                GexLab Sync
            </div>
            <div style="display:grid;grid-template-columns:1fr auto;row-gap:3px;column-gap:8px;margin-bottom:10px">
                <span style="color:#6b7280">GEX Flip</span>
                <span style="color:#f0c040;font-weight:600;text-align:right">${fmt(levels?.gammaFlip)}</span>
                <span style="color:#6b7280">Call Wall</span>
                <span style="color:#26a69a;font-weight:600;text-align:right">${fmt(levels?.callWall)}</span>
                <span style="color:#6b7280">Put Wall</span>
                <span style="color:#ef5350;font-weight:600;text-align:right">${fmt(levels?.putWall)}</span>
                <span style="color:#6b7280">Max Pain</span>
                <span style="color:#c9a84c;font-weight:600;text-align:right">${fmt(levels?.maxPain)}</span>
                <span style="color:#6b7280">Vanna</span>
                <span style="color:#ab88f5;font-weight:600;text-align:right">${fmt(levels?.vannaMagnet)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #2a2e39;padding-top:9px;margin-top:2px">
                <span style="color:#3d4455;font-size:9px">${age}</span>
                <button id="gexlab-refresh-btn"
                    style="background:#2962ff;border:none;border-radius:5px;color:#fff;
                           padding:3px 9px;font-size:9px;font-weight:700;cursor:pointer;
                           letter-spacing:.05em;text-transform:uppercase">
                    Sync Now
                </button>
            </div>
        `;

        document.getElementById('gexlab-refresh-btn').onclick = () => {
            refresh();
        };
    }

    // Keep the age counter ticking without a full re-fetch.
    setInterval(() => {
        if (lastFetch) renderPanel();
    }, 10_000);

    // ─── Init ─────────────────────────────────────────────────────────────────

    // TradingView is a SPA — wait for the app shell to mount before injecting.
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
