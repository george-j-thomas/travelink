# Chrome Web Store listing

Everything the Chrome Web Store developer dashboard asks for, for the travel-ink extension. Keep it in
step with `manifest.json`, `README.md` (what the extension does) and travel-ink's privacy page
(`src/app/privacy/page.tsx`).

## Package

- Build: `TRAVELINK_URL=https://www.travel-ink.net npm run ext:build`, then zip the contents of
  `extension/dist/` (see `README.md`, Publishing).
- Version: `1.0.0` (from `manifest.json`).

## Store listing tab

**Name** (from the manifest): travel-ink

**Summary** (from the manifest's `description`, 132 characters at most):

> Add tattoo artists to travel-ink straight from their Instagram profile.

**Description:**

```text
travel-ink shows where the tattoo artists you follow on Instagram are working: their home base, their guest spots and the dates, on one map.

This extension adds an "Add" button to Instagram profiles, so you can add artists to travel-ink as you find them, without exporting your data or connecting your Instagram session.

How it works
1. Open a tattoo artist's profile on instagram.com.
2. Click "Add @handle" at the bottom right of the page.
3. travel-ink adds them to your list and reads their bio for locations. They show up on your map.

Artists already on your list show "On your list", with a link to their page on travel-ink. If you aren't signed in, the button opens travel-ink so you can sign in, and finishes the add once you have.

Private by design
- It only reads the address of the Instagram page you're on, to tell which profile it is. It doesn't read the page, your messages, or your Instagram login or cookies.
- It never contacts Instagram, and never adds anything until you click.
- It only sends a profile's handle to travel-ink when you click Add.
- No ads, no analytics.

Requires a travel-ink account. travel-ink is invite-only for now.
Works in Chrome, Edge and other Chromium browsers on desktop. In Brave, its default privacy settings keep the extension from seeing that you're signed in, so the button opens travel-ink to finish each add.
```

**Category:** Lifestyle → Social Networking (or Productivity → Tools)

**Language:** English

**Graphic assets** (all in this folder):

| Field | File | Size |
| --- | --- | --- |
| Store icon | `store-icon-128.png` | 128×128 (96×96 artwork, transparent padding) |
| Screenshots | `screenshot-1-add-button.png`, `screenshot-2-added.png`, `screenshot-3-map.png`, `screenshot-4-artist.png` | 1280×800 |
| Small promo tile | `promo-small-440x280.png` | 440×280 |
| Marquee promo tile (optional) | `marquee-1400x560.png` | 1400×560 |

The screenshots use fictional artists (local seed data) and a mock profile page in place of Instagram,
with the real extension button on it.

**Official URL:** none (or `https://www.travel-ink.net`, once the domain is verified in Google Search Console)

**Homepage URL:** `https://www.travel-ink.net`

**Support URL:** `https://www.travel-ink.net` (until there's a support page or address)

## Privacy tab

**Single purpose:**

```text
Adds tattoo artists to the user's travel-ink list from their Instagram profile pages: it shows an "Add" button on Instagram profiles, and clicking it adds that profile's artist to the user's travel-ink account.
```

**Permission justifications:**

- `storage`:

  ```text
  Used only for chrome.storage.session: when the user clicks Add while signed out of travel-ink, the extension remembers that handle and the travel-ink tab it opened (for at most 30 minutes, in memory, cleared when the browser closes) so it can finish the add once the user has signed in.
  ```

- Host permission (`https://www.travel-ink.net/*`) and the content script on `https://www.instagram.com/*`:

  ```text
  instagram.com: the content script reads the page address to tell which profile is open and shows the Add button there. It doesn't read page content and makes no requests to Instagram.
  www.travel-ink.net: the extension's own service. The extension asks it for the user's list (to show "On your list") and sends it the handle the user clicks Add on, signed in with the user's travel-ink login. It also watches the travel-ink tab it opened for sign-in, to finish the add once the user has signed in.
  ```

**Are you using remote code?** No. All scripts are in the package.

**Data usage** (what the extension collects):

- [x] Website content — the handle of the Instagram profile the user clicks Add on, sent to travel-ink to add that artist.
- Nothing else (no personally identifiable, health, financial, authentication, communications, location, web history or user activity data).

Certify all three:

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** `https://www.travel-ink.net/privacy`

## Distribution tab

- **Visibility:** Unlisted. travel-ink is invite-only, so people get the link from the Artists page
  (`EXTENSION_STORE_URL`) rather than store search. Switch to Public if that changes.
- **Regions:** all.

## Test instructions (for the reviewer)

Reviewers can't use the extension without a travel-ink account. Create one for them (an invite from
the admin page), and put the email and password in the dashboard's test instructions, not in this repo:

```text
1. Sign in at https://www.travel-ink.net/login with the account below.
2. Open any public Instagram profile of a tattoo artist, e.g. https://www.instagram.com/<handle>/.
3. Click "Add @handle" at the bottom right. The button turns into "Added to your list", and the artist appears at https://www.travel-ink.net/artists.
Account: <email> / <password>
```
