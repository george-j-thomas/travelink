import type { Metadata } from "next"
import Link from "next/link"

import { CONTACT_EMAIL, PRIVACY_POLICY_UPDATED } from "@/lib/site"

export const metadata: Metadata = {
  title: "Privacy policy · travel-ink",
  description: "What travel-ink and its browser extension collect, why, and who it's shared with.",
}

// Public: the Chrome Web Store listing links here. Keep it in step with what the app and the
// extension actually do (see AGENTS.md), and update PRIVACY_POLICY_UPDATED with each change.
export default function PrivacyPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4 sm:px-6">
          <Link
            href="/"
            className="select-none text-sm font-medium uppercase tracking-[0.25em] text-muted-foreground transition-colors hover:text-foreground"
          >
            travel-<span className="text-brand-400">ink</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {PRIVACY_POLICY_UPDATED}</p>

        <div className="mt-8 space-y-10 text-sm leading-relaxed text-muted-foreground [&_a]:text-brand-400 [&_a]:underline-offset-4 [&_a:hover]:text-brand-300 [&_a]:underline [&_strong]:font-medium [&_strong]:text-foreground">
          <p>
            travel-ink is an invite-only website that shows where the tattoo artists you follow on
            Instagram are working. This policy covers the website and the travel-ink browser
            extension. In short: travel-ink keeps what it needs to run your account and your list of
            artists, doesn&apos;t sell anything about you, and doesn&apos;t show ads or track you
            across other sites.
          </p>

          <Section title="What travel-ink stores about you">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Your account:</strong> your email address and a hash of your password (never
                the password itself). If you sign in with Instagram, your Instagram account ID, name,
                profile picture link and the sign-in tokens Instagram issues instead.
              </li>
              <li>
                <strong>Your list:</strong> the artists you add and your notes on them. Locations you
                add or fix by hand are saved on the artist, for everyone who follows them, without
                your name.
              </li>
              <li>
                <strong>Running the service:</strong> the invite you signed up with, and daily counts
                of the Instagram lookups you start, to keep within usage limits.
              </li>
            </ul>
          </Section>

          <Section title="Artists">
            <p>
              For each artist added, travel-ink fetches their public Instagram profile (handle, name,
              bio and profile photo) through Meta&apos;s official API for public Business and Creator
              accounts, and works out the locations in their bio. Artists are shared between users,
              but travel-ink never shows who added an artist or how many people follow one. Other
              users can only find artists with a public Business or Creator account.
            </p>
          </Section>

          <Section title="Importing from Instagram">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Data export:</strong> the file you upload is read to list the accounts you
                follow, then discarded. Only the artists you pick are saved.
              </li>
              <li>
                <strong>Instagram session:</strong> if you connect your Instagram session to import
                or search, it&apos;s kept in your browser tab&apos;s memory only. It&apos;s sent to
                travel-ink with each request that needs it, used for that request to ask Instagram,
                and never stored or logged. Closing or reloading the tab, or signing out, forgets it.
              </li>
            </ul>
          </Section>

          <Section title="The browser extension">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                It runs only on instagram.com, where it reads the address of the page to tell which
                profile you&apos;re on. It doesn&apos;t read the page itself, your messages, or your
                Instagram login or cookies, and it never contacts Instagram.
              </li>
              <li>
                On a profile, it asks travel-ink for the list of artists you&apos;ve added (using your
                travel-ink sign-in) to show whether this one is on it. That request doesn&apos;t say
                which profile you&apos;re looking at.
              </li>
              <li>
                Only when you click <strong>Add</strong> does it send that profile&apos;s handle to
                travel-ink, to add the artist to your list.
              </li>
              <li>
                If you click Add while signed out, it remembers the handle and the tab it opened for
                you to sign in, in your browser&apos;s memory, for at most 30 minutes, so it can finish
                the add once you have. Closing the browser clears it.
              </li>
              <li>It has no analytics or ads, and doesn&apos;t load code from anywhere.</li>
            </ul>
          </Section>

          <Section title="In your browser">
            <p>
              travel-ink sets one cookie, to keep you signed in. Your browser&apos;s storage also
              keeps a few things for you: an import in progress, the bio queue&apos;s state and which
              tips you&apos;ve dismissed. They stay on your device.
            </p>
          </Section>

          <Section title="Services travel-ink uses">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Vercel</strong> hosts the website, and a managed PostgreSQL database stores
                the data above. Their logs (which include IP addresses) are kept for a limited time.
              </li>
              <li>
                <strong>Meta (Instagram)</strong> receives the handles travel-ink looks up, your
                sign-in if you use Instagram to sign in, and your session&apos;s requests if you
                import with it.
              </li>
              <li>
                <strong>Anthropic (Claude)</strong> reads artists&apos; public bios to pick out their
                locations. Nothing about you is sent.
              </li>
              <li>
                <strong>Mapbox</strong> turns location names into map positions, and draws the map in
                your browser, which sends it your IP address like any map would.
              </li>
            </ul>
            <p className="mt-3">
              travel-ink doesn&apos;t sell or rent your information, use it for ads, or share it for
              any other purpose.
            </p>
          </Section>

          <Section title="Keeping and deleting your data">
            <p>
              Your account and list are kept until you ask for them to be deleted. Deleting your
              account removes it and your list. Artists stay in travel-ink while someone else still
              follows them, since their information comes from their public profile.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              {CONTACT_EMAIL ? (
                <>
                  To ask about your data, or to have it deleted, email{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                </>
              ) : (
                <>
                  To ask about your data, or to have it deleted, contact the person who invited you
                  to travel-ink.
                </>
              )}{" "}
              If this policy changes, the date at the top changes with it.
            </p>
          </Section>
        </div>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  )
}
