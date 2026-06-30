// ==UserScript==
// @name         GexLab — TradingView Auto-Sync
// @namespace    https://gexlab.app
// @version      1.0.0
// @description  Automatically fills GexLab key levels into the GexLab Levels indicator when you open its settings. Shows a live levels panel in the corner.
// @author       GexLab
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

    // Returns the dialog element if the added node IS or CONTAINS the
    // GexLab Levels settings dialog, otherwise null.
    function findGexLabDialog(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return null;

        // Quick bail: skip nodes that don't contain our indicator name at all.
        if (!node.textContent?.includes(INDICATOR)) return null;

        // Check the node itself
        if (isSettingsDialog(node)) return node;

        // Check children matching dialog roles/attributes
        const candidates = node.querySelectorAll(
            '[role="dialog"], [data-name*="dialog"], [class*="dialog"]'
        );
        for (const c of candidates) {
            if (isSettingsDialog(c)) return c;
        }

        return null;
    }

    function isSettingsDialog(el) {
        // Must contain the indicator name AND at least one number input
        // (to distinguish from other dialogs that might mention "GexLab").
        return (
            el.textContent?.includes(INDICATOR) &&
            el.querySelector('input[type="number"]') !== null
        );
    }

    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                const dialog = findGexLabDialog(node);
                if (dialog) {
                    // Small delay to let TradingView finish rendering all inputs.
                    setTimeout(() => fillDialog(dialog), 400);
                    return;
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

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
