// The "Add to travel-ink" button that the content script shows on Instagram profile pages.
//
// Isolation. Everything renders in a closed shadow root on a host element we own
// (<travelink-add-button>), appended to the end of <body>, outside the root that Instagram's React
// app renders into. Nothing here reads or changes Instagram's markup. `:host { all: initial
// !important }` stops Instagram's inherited styles (font, color, line-height…) at the host, and the
// shadow root keeps our styles from reaching the page.
//
// CSP. Styles go in as a constructed stylesheet (adoptedStyleSheets). CSP's style-src covers
// <style>, <link> and style="" attributes, not constructed sheets, so the button looks the same
// however strict Instagram's policy gets. The DOM is built with createElement (no innerHTML), so a
// Trusted Types policy can't block it either. Icons are inline SVG paths. No fonts, images or
// other external resources.
//
// Placement. Bottom right, raised above Instagram's floating Messages pill, so at desktop widths
// it stays clear of the left nav, the pill and the profile header (which sits at the top of the
// page). It uses inset-inline-end, so it moves to the bottom left when Instagram mirrors its
// layout for right-to-left languages. Below 600px wide (and once minimized) it shrinks to the
// badge alone.
//
// Layering. z-index 1 on a host that comes after Instagram's root in the DOM: that's above
// in-flow content and anything else at z-index 0 or 1 (ties go to the later element), but below
// any layer Instagram raises higher for its dialogs, menus and popovers. If a future Instagram
// redesign ever hides the button behind page content, raise HOST_Z_INDEX and accept that it'll
// float over modals too.
//
// States. Expanded (default): brand badge, the travel-ink wordmark, "Add @handle", and a
// minimize button. Minimized (for the rest of the page session, i.e. until reload): the badge
// alone. The badge is still the link, with a tooltip on hover and keyboard focus.

export interface AddButton {
  /**
   * Show (or update) the button for this handle. `href` is the travel-ink Add page URL to open.
   * Cheap to call repeatedly: unchanged values aren't rewritten. Returns true when it put the
   * button on the page (it was hidden, or something removed it), false when it was already there.
   */
  show(handle: string, href: string): boolean
  /** Hide the button (non-profile pages). */
  hide(): void
}

const HOST_TAG = "travelink-add-button"
const HOST_Z_INDEX = 1
const SVG_NS = "http://www.w3.org/2000/svg"

/** The brand pin from the extension icon, with a plus cut out of its head ("add a pin"). */
const PIN_PLUS_PATH =
  "M30 53A34 34 0 0 1 98 53C98 76.4 81 95.5 68.8 108.8Q64 114 59.2 108.8C47 95.5 30 76.4 30 53Z" +
  "M58 37H70V47H80V59H70V69H58V59H48V47H58Z"

// Colors are travel-ink's tokens (src/app/globals.css) written out, since there's no Tailwind
// here: brand-* is Tailwind's purple, the neutrals are the app's dark theme. Sizes are in em off
// the host's `font-size: medium`, so the button follows the browser's font-size setting rather
// than Instagram's root font size. Offsets from the viewport edges stay in px, like Instagram's
// own floating UI.
const STYLES = `
:host {
  all: initial !important;
  position: fixed !important;
  inset-inline-end: 20px !important;
  bottom: 104px !important;
  z-index: ${HOST_Z_INDEX} !important;
  display: block !important;
}

@media print {
  :host { display: none !important; }
}

.root {
  --brand-400: oklch(71.4% 0.203 305.504);
  --brand-500: oklch(62.7% 0.265 303.9);
  --brand-600: oklch(55.8% 0.288 302.321);
  --brand-700: oklch(49.6% 0.265 301.924);
  --foreground: oklch(0.985 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --card: oklch(0.205 0 0);
  --border: oklch(1 0 0 / 12%);

  position: relative;
  display: flex;
  align-items: center;
  gap: 0.25em;
  box-sizing: border-box;
  max-width: calc(100vw - 40px);
  padding: 0.375em;
  /* The app's dark card as glass. The hairline border separates it from Instagram's black
     dark mode; the shadow lifts it off the white light mode. */
  border: 1px solid var(--border);
  border-radius: 1em;
  background: oklch(0.205 0 0 / 0.92);
  backdrop-filter: blur(24px) saturate(1.5);
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 6%),
    0 1px 2px oklch(0 0 0 / 0.3),
    0 12px 32px -8px oklch(0 0 0 / 0.5);
  color: var(--foreground);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.25;
  -webkit-font-smoothing: antialiased;
  transition: border-color 150ms;
}

.root:hover,
.root:has(:focus-visible) {
  border-color: oklch(62.7% 0.265 303.9 / 0.45);
}

/* The link: badge + wordmark + "Add @handle" */
.add {
  display: flex;
  align-items: center;
  gap: 0.625em;
  min-width: 0;
  padding-inline-end: 0.75em;
  border-radius: 0.625em;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 150ms;
}

.add:hover {
  background: oklch(1 0 0 / 6%);
}

/* brand-500 keeps at least 4:1 against the dark chip, Instagram's white and its black. The ring
   sits inside the chip's padding, so it's always drawn on the chip. */
.add:focus-visible,
.minimize:focus-visible {
  outline: 2px solid var(--brand-500);
  outline-offset: 2px;
}

/* Filled accent, like the app's buttons: bg-brand-600 text-white hover:bg-brand-700 */
.badge {
  display: grid;
  flex: none;
  place-items: center;
  box-sizing: border-box;
  width: 2.25em;
  height: 2.25em;
  /* Invisible normally; becomes the badge's outline in forced-colors mode, where backgrounds go */
  border: 1px solid transparent;
  border-radius: 0.625em;
  background: var(--brand-600);
  box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.2);
  color: #fff;
  transition: background-color 150ms;
}

.add:hover .badge {
  background: var(--brand-700);
}

.badge svg {
  width: 1.25em;
  height: 1.25em;
}

.text {
  display: flex;
  flex-direction: column;
  gap: 0.1875em;
  min-width: 0;
}

/* The wordmark: "TRAVEL-" muted + "INK" brand-400, uppercased from "travel-" + "ink" */
.wordmark {
  color: var(--muted-foreground);
  font-size: 0.6875em;
  font-weight: 500;
  letter-spacing: 0.25em;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
  transition: color 150ms;
}

/* Like the app navbar's wordmark, hovering lights up "travel-" */
.add:hover .wordmark {
  color: var(--foreground);
}

.ink {
  color: var(--brand-400);
}

.action {
  max-width: 13em;
  overflow: hidden;
  font-size: 0.875em;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.divider {
  flex: none;
  width: 1px;
  height: 1.5em;
  background: oklch(1 0 0 / 10%);
}

.minimize {
  display: grid;
  flex: none;
  place-items: center;
  width: 2em;
  height: 2em;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0.5em;
  background: transparent;
  color: var(--muted-foreground);
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 150ms, color 150ms;
}

.minimize:hover {
  background: oklch(1 0 0 / 8%);
  color: var(--foreground);
}

.minimize svg {
  width: 1em;
  height: 1em;
}

/* Minimized, and narrow windows: the badge alone */
.root[data-minimized] .text,
.root[data-minimized] .divider,
.root[data-minimized] .minimize {
  display: none;
}

.root[data-minimized] .add {
  padding: 0;
}

/* Names the badge for sighted users once the text is gone. aria-hidden: the link's own
   aria-label already says this to screen readers. */
.tip {
  position: absolute;
  inset-inline-end: 0;
  bottom: calc(100% + 0.5em);
  box-sizing: border-box;
  max-width: calc(100vw - 40px);
  overflow: hidden;
  padding: 0.5em 0.75em;
  border: 1px solid var(--border);
  border-radius: 0.5em;
  background: var(--card);
  box-shadow: 0 8px 24px -6px oklch(0 0 0 / 0.5);
  color: var(--foreground);
  font-size: 0.75em;
  font-weight: 500;
  text-overflow: ellipsis;
  unicode-bidi: plaintext;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 120ms, visibility 120ms;
}

.root[data-minimized] .add:is(:hover, :focus-visible) ~ .tip {
  opacity: 1;
  visibility: visible;
}

@media (max-width: 600px) {
  .text,
  .divider,
  .minimize {
    display: none;
  }

  .add {
    padding: 0;
  }

  .add:is(:hover, :focus-visible) ~ .tip {
    opacity: 1;
    visibility: visible;
  }
}

/* Movement only for people who haven't asked for less of it */
@media (prefers-reduced-motion: no-preference) {
  .root {
    animation: rise 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  .badge {
    transition: background-color 150ms, transform 120ms;
  }

  .add:active .badge {
    transform: scale(0.94);
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}
`

/** Called once by the content script. */
export function createAddButton(): AddButton {
  const host = document.createElement(HOST_TAG)
  // Closed: Instagram's scripts can't reach in through host.shadowRoot.
  const shadow = host.attachShadow({ mode: "closed" })
  adoptStyles(shadow, STYLES)

  const handleText = h("span", { translate: "no" })
  const link = h(
    "a",
    { class: "add", target: "_blank", rel: "noopener noreferrer", referrerpolicy: "no-referrer" },
    h("span", { class: "badge" }, icon("16 17 96 96", { d: PIN_PLUS_PATH, fill: "currentColor", "fill-rule": "evenodd" })),
    h(
      "span",
      { class: "text", dir: "ltr" },
      h("span", { class: "wordmark", translate: "no" }, "travel-", h("span", { class: "ink" }, "ink")),
      h("span", { class: "action" }, "Add ", handleText),
    ),
  )
  const minimize = h(
    "button",
    // The title is both the tooltip and the accessible name, so screen readers hear it once.
    { class: "minimize", type: "button", title: "Minimize travel-ink" },
    icon("0 0 24 24", {
      d: "M6 12h12",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
    }),
  )
  const tip = h("span", { class: "tip", "aria-hidden": "true" })
  const root = h(
    "div",
    // A landmark, so screen reader users can jump straight to it from anywhere on the page.
    { class: "root", role: "complementary", "aria-label": "travel-ink", lang: "en" },
    link,
    h("span", { class: "divider", "aria-hidden": "true" }),
    minimize,
    tip,
  )
  shadow.append(root)

  minimize.addEventListener("click", () => {
    // Stays minimized across profiles until the page reloads.
    root.setAttribute("data-minimized", "")
    // The button is about to disappear; don't drop keyboard focus on <body>.
    link.focus()
  })

  let shownHandle: string | null = null

  return {
    show(handle, href) {
      const name = handle.replace(/^@/, "")
      if (name !== shownHandle) {
        shownHandle = name
        handleText.textContent = `@${name}`
        tip.textContent = `Add @${name} to travel-ink`
        // Starts with the visible label ("Add @handle"), so speech input matches it too.
        link.setAttribute("aria-label", `Add @${name} to travel-ink (opens in a new tab)`)
      }
      if (link.getAttribute("href") !== href) link.setAttribute("href", href)
      // React re-renders, or anything else, may have taken the host out of the document.
      if (host.isConnected) return false
      const parent = document.body ?? document.documentElement
      parent.append(host)
      return true
    },
    hide() {
      host.remove()
    },
  }
}

function adoptStyles(shadow: ShadowRoot, css: string): void {
  try {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(css)
    shadow.adoptedStyleSheets = [sheet]
  } catch {
    // Only for browsers without constructable stylesheets (Chrome has had them since 73, MV3
    // needs 88). This one works only where the page's CSP allows inline styles.
    const style = document.createElement("style")
    style.textContent = css
    shadow.append(style)
  }
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string>,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  element.append(...children)
  return element
}

/** A decorative inline SVG icon: hidden from screen readers and never a tab stop. */
function icon(viewBox: string, path: Record<string, string>): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg")
  svg.setAttribute("viewBox", viewBox)
  svg.setAttribute("aria-hidden", "true")
  svg.setAttribute("focusable", "false")
  const shape = document.createElementNS(SVG_NS, "path")
  for (const [name, value] of Object.entries(path)) shape.setAttribute(name, value)
  svg.append(shape)
  return svg
}
