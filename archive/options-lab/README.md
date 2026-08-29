# Options lab (archived)

Fixed bottom-left control panel used to A/B test site interaction variants
(originally nav letter-hover modes: stagger, wave, scatter, flip, scramble).

## Reuse later

1. Copy panel markup from `panel.snippet.html` into the page.
2. Paste styles from `panel.css`.
3. Wire option buttons with `data-*` attributes + `localStorage` (see `nav-hover-lab.js`).
4. Scope experimental styles with `html[data-option="…"]` so they stay removable.

## Live site

Production nav uses **flip reveal only** via `js/nav-flip.js` — no panel.
