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
// Sizes. Expanded (default): brand badge, the travel-ink wordmark, the action ("Add @handle"…),
// and a minimize button. Minimized (for the rest of the page session, i.e. until reload): the
// badge alone. The badge is still the control, with a tooltip on hover and keyboard focus.
//
// States (ButtonState). "add" and "failed" are a <button> that adds in place (the content script
// passes the click to the service worker; the click is the user's confirmation), and "adding" is
// that button while the request runs. "added", "on-list", "sign-in" and "add-link" are links that
// open travel-ink in a new tab: the artist's page, or the Add page (which signs the user in
// first). "added" can carry a warning from travel-ink (e.g. the bio isn't public), shown under the
// action. A visually hidden live region announces the add's progress to screen readers.

export type ButtonState =
  /** Not on the user's list (or not checked yet): clicking adds the artist in place. */
  | { kind: "add" }
  /** The add request is running. */
  | { kind: "adding" }
  /** Just added (or it turned out to be on the list already): a link to the artist's page. */
  | { kind: "added"; href: string; existing: boolean; warning: string | null }
  /** On the user's list: a link to the artist's travel-ink page. */
  | { kind: "on-list"; href: string }
  /** Signed out of travel-ink: a link to the Add page, which signs the user in first. */
  | { kind: "sign-in"; href: string }
  /** The service worker can't be reached (e.g. the extension was updated): v0's Add page link. */
  | { kind: "add-link"; href: string }
  /** The add failed with `message`; clicking tries again. */
  | { kind: "failed"; message: string }

export interface AddButton {
  /**
   * Show (or update) the button for this handle, in `state`. Cheap to call repeatedly: unchanged
   * values aren't rewritten. Returns true when it put the button on the page (it was hidden, or
   * something removed it), false when it was already there.
   */
  show(handle: string, state: ButtonState): boolean
  /** Hide the button (non-profile pages). */
  hide(): void
}

export interface AddButtonOptions {
  /** A real click on "add" or "failed": add `handle` (without the @). */
  onAdd(handle: string): void
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

/* The same look when .add is a <button> (states that add in place) */
button.add {
  margin: 0;
  padding-block: 0;
  padding-inline-start: 0;
  border: 0;
  background: transparent;
  font: inherit;
  text-align: start;
}

.root[data-state="adding"] .add {
  cursor: progress;
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

/* A warning from travel-ink after adding, e.g. the bio isn't public. Raw amber, like the app's
   warnings (amber-300). */
.note {
  display: -webkit-box;
  max-width: 17em;
  overflow: hidden;
  color: oklch(87.9% 0.169 91.605);
  font-size: 0.75em;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.note:empty {
  display: none;
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

/* A warning can be long: let it wrap rather than cut it off */
.root[data-state="added"] .tip {
  width: max-content;
  max-width: min(20em, calc(100vw - 40px));
  white-space: normal;
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

/* The add failed: an error tint on the action, so it doesn't read as "Add" again */
.root[data-state="failed"] .action {
  color: oklch(0.808 0.114 19.571);
}

/* Screen readers only: announces adding, added and failures */
.live {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
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

  .root[data-state="adding"] .badge {
    animation: pulse 1s ease-in-out infinite alternate;
  }
}

@keyframes pulse {
  to {
    opacity: 0.55;
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
export function createAddButton(options: AddButtonOptions): AddButton {
  const host = document.createElement(HOST_TAG)
  // Closed: Instagram's scripts can't reach in through host.shadowRoot.
  const shadow = host.attachShadow({ mode: "closed" })
  adoptStyles(shadow, STYLES)

  const pinPlusIcon = icon("16 17 96 96", { d: PIN_PLUS_PATH, fill: "currentColor", "fill-rule": "evenodd" })
  const checkIcon = icon("0 0 24 24", {
    d: "M5 12.5l4.5 4.5L19 7.5",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  })
  const badge = h("span", { class: "badge" }, pinPlusIcon)
  const actionText = h("span", { class: "action", translate: "no" })
  const note = h("span", { class: "note" })
  const content = [
    badge,
    h(
      "span",
      { class: "text", dir: "ltr" },
      h("span", { class: "wordmark", translate: "no" }, "travel-", h("span", { class: "ink" }, "ink")),
      actionText,
      note,
    ),
  ]
  // Two controls share the badge and text: a link for states that open travel-ink, a button for
  // states that act in place. Only one is in the DOM at a time.
  const link = h("a", { class: "add", target: "_blank", rel: "noopener noreferrer", referrerpolicy: "no-referrer" })
  const action = h("button", { class: "add", type: "button" })
  link.append(...content)
  let control: HTMLAnchorElement | HTMLButtonElement = link

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
  const live = h("span", { class: "live", role: "status" })
  const root = h(
    "div",
    // A landmark, so screen reader users can jump straight to it from anywhere on the page.
    { class: "root", role: "complementary", "aria-label": "travel-ink", lang: "en" },
    link,
    h("span", { class: "divider", "aria-hidden": "true" }),
    minimize,
    tip,
    live,
  )
  shadow.append(root)

  let shownHandle: string | null = null
  let shownState: ButtonState | null = null

  minimize.addEventListener("click", () => {
    // Stays minimized across profiles until the page reloads.
    root.setAttribute("data-minimized", "")
    // The button is about to disappear; don't drop keyboard focus on <body>.
    control.focus()
  })

  action.addEventListener("click", (event) => {
    // Only the user's own clicks, not ones a page script dispatches.
    if (!event.isTrusted || !shownHandle) return
    if (shownState?.kind === "add" || shownState?.kind === "failed") options.onAdd(shownHandle)
  })

  function switchControl(next: HTMLAnchorElement | HTMLButtonElement): void {
    if (control === next) return
    const hadFocus = shadow.activeElement === control
    next.append(...content)
    control.replaceWith(next)
    control = next
    if (hadFocus) next.focus()
  }

  function render(name: string, state: ButtonState): void {
    const at = `@${name}`
    let label: string
    let tipText: string
    let announcement = ""
    let noteText = ""
    switch (state.kind) {
      case "add":
        actionText.textContent = `Add ${at}`
        // Starts with the visible label ("Add @handle"), so speech input matches it too.
        label = `Add ${at} to travel-ink`
        tipText = label
        break
      case "adding":
        actionText.textContent = `Adding ${at}…`
        label = `Adding ${at} to travel-ink`
        tipText = `${label}…`
        announcement = tipText
        break
      case "added": {
        const done = state.existing ? "Already on your list" : "Added to your list"
        actionText.textContent = done
        noteText = state.warning ?? ""
        label = `${at}: ${done}.${noteText ? ` ${noteText}` : ""} Open on travel-ink (opens in a new tab)`
        tipText = noteText ? `${done}. ${noteText}` : `${at}: ${done}`
        announcement = state.existing ? `${at} is already on your travel-ink list` : `Added ${at} to travel-ink`
        if (noteText) announcement += `. ${noteText}`
        break
      }
      case "on-list":
        // The badge shows the check mark.
        actionText.textContent = "On your list"
        label = `${at} is on your travel-ink list. Open on travel-ink (opens in a new tab)`
        tipText = `${at} is on your list`
        break
      case "sign-in":
        actionText.textContent = "Sign in to travel-ink"
        label = `Sign in to travel-ink to add ${at} (opens in a new tab)`
        tipText = label
        break
      case "add-link":
        actionText.textContent = `Add ${at}`
        label = `Add ${at} to travel-ink (opens in a new tab)`
        tipText = `Add ${at} to travel-ink`
        break
      case "failed":
        actionText.textContent = "Couldn't add. Try again"
        label = `Couldn't add ${at}: ${state.message} Try again`
        tipText = state.message
        announcement = `Couldn't add ${at}: ${state.message}`
        break
    }

    const isLink = "href" in state
    switchControl(isLink ? link : action)
    if (isLink) link.setAttribute("href", state.href)
    if (state.kind === "adding") {
      // aria-disabled rather than disabled, so keyboard focus stays on the button.
      action.setAttribute("aria-disabled", "true")
      action.setAttribute("aria-busy", "true")
    } else {
      action.removeAttribute("aria-disabled")
      action.removeAttribute("aria-busy")
    }
    if (state.kind === "failed") action.setAttribute("title", state.message)
    else action.removeAttribute("title")
    control.setAttribute("aria-label", label)
    note.textContent = noteText
    badge.replaceChildren(state.kind === "on-list" || state.kind === "added" ? checkIcon : pinPlusIcon)
    tip.textContent = tipText
    root.setAttribute("data-state", state.kind)
    live.textContent = announcement
  }

  return {
    show(handle, state) {
      const name = handle.replace(/^@/, "")
      if (name !== shownHandle || !sameState(state, shownState)) {
        render(name, state)
        shownHandle = name
        shownState = state
      }
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

function sameState(a: ButtonState, b: ButtonState | null): boolean {
  if (!b || a.kind !== b.kind) return false
  return JSON.stringify(a) === JSON.stringify(b)
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
