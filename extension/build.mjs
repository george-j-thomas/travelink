// Builds the travel-ink browser extension into extension/dist/, the folder to load unpacked or zip
// for the Chrome Web Store: bundles the scripts with esbuild, renders icons/icon.svg to the PNG
// sizes manifest.json lists, and copies the manifest.
//
//   node extension/build.mjs           one-off build (npm run ext:build)
//   node extension/build.mjs --watch   rebuild the scripts on change (npm run ext:watch)
//
// TRAVELINK_URL sets the travel-ink origin (default http://localhost:3000): what the button links
// to, and the extension's only host permission, which the service worker calls travel-ink with.
// Needs Node 20.9+ (sharp).
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import * as esbuild from "esbuild"

const EXTENSION_DIR = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(EXTENSION_DIR, "dist")
const MANIFEST_PATH = path.join(EXTENSION_DIR, "manifest.json")
const ICON_SVG_PATH = path.join(EXTENSION_DIR, "icons", "icon.svg")
const TSCONFIG_PATH = path.join(EXTENSION_DIR, "tsconfig.json")

// Output name in dist/ (".js" added) → source. Each script manifest.json references needs an entry.
const ENTRY_POINTS = {
  content: path.join(EXTENSION_DIR, "src", "content.ts"),
  background: path.join(EXTENSION_DIR, "src", "background.ts"),
}

const DEFAULT_TRAVELINK_URL = "http://localhost:3000"
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"])

function log(step, details) {
  console.log(`[ext:build] ${step}`, details)
}

// sharp needs Node 20.9+, and on older versions it fails to load with a cryptic syntax error.
function checkNodeVersion() {
  const [major, minor] = process.versions.node.split(".").map(Number)
  if (major < 20 || (major === 20 && minor < 9)) {
    throw new Error(`Node 20.9 or later is needed (sharp renders the icons), this is ${process.version}. Run \`nvm use\` in the repo.`)
  }
}

/** travel-ink's origin from TRAVELINK_URL. It must be a bare origin, using https unless it's local. */
function readTravelinkOrigin(env) {
  const raw = env.TRAVELINK_URL ?? DEFAULT_TRAVELINK_URL
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`TRAVELINK_URL must be an origin like "https://travelink.example", got "${raw}"`)
  }
  const isLocal = LOCAL_HOSTNAMES.has(url.hostname)
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    throw new Error(`TRAVELINK_URL must use https (http is only allowed for localhost and 127.0.0.1), got "${raw}"`)
  }
  // No credentials, path, query or fragment. A single trailing slash is fine.
  if (raw.replace(/\/$/, "") !== url.origin) {
    throw new Error(`TRAVELINK_URL must be a bare origin like "${url.origin}", got "${raw}"`)
  }
  return url.origin
}

/** Renders icons/icon.svg at each size in the manifest's "icons" ({ "16": "icons/icon-16.png", … }). */
async function writeIcons(icons) {
  const { default: sharp } = await import("sharp")
  const svg = await readFile(ICON_SVG_PATH)
  const { width, height } = await sharp(svg).metadata()
  if (!width || !height) throw new Error(`Couldn't read the size of ${ICON_SVG_PATH}`)

  for (const [size, file] of Object.entries(icons)) {
    const pixels = Number(size)
    // Rasterize straight at the target size (72 dpi is the SVG's own size) so small icons stay crisp.
    const density = Math.max(1, (72 * pixels) / Math.max(width, height))
    const outPath = path.join(DIST_DIR, file)
    await mkdir(path.dirname(outPath), { recursive: true })
    await sharp(svg, { density })
      .resize(pixels, pixels, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outPath)
  }
  log("icons", { source: "icons/icon.svg", svgSize: `${width}x${height}`, pngs: Object.values(icons) })
}

/**
 * The manifest for dist/: manifest.json plus the host permission for travel-ink's origin, so the
 * permission always matches the origin the scripts were built with.
 */
function buildManifest(source, origin) {
  if (source.host_permissions || source.optional_host_permissions) {
    throw new Error("Don't list host permissions in manifest.json: the build adds travel-ink's from TRAVELINK_URL")
  }
  return { ...source, host_permissions: [`${origin}/*`] }
}

/** Fails the build when manifest.json points at a file that isn't in dist/. */
async function checkManifestFiles(manifest) {
  const files = [
    ...Object.values(manifest.icons ?? {}),
    ...(manifest.content_scripts ?? []).flatMap((script) => [...(script.js ?? []), ...(script.css ?? [])]),
    ...(manifest.background?.service_worker ? [manifest.background.service_worker] : []),
  ]
  for (const file of files) {
    try {
      await access(path.join(DIST_DIR, file))
    } catch {
      throw new Error(`manifest.json references "${file}", but the build didn't produce dist/${file}`)
    }
  }
  log("checked manifest files", { files })
}

async function main() {
  checkNodeVersion()
  const watch = process.argv.includes("--watch")
  const origin = readTravelinkOrigin(process.env)
  log("start", {
    mode: watch ? "watch" : "build",
    origin,
    originFrom: process.env.TRAVELINK_URL === undefined ? "default" : "TRAVELINK_URL",
    outDir: path.relative(process.cwd(), DIST_DIR),
  })

  await rm(DIST_DIR, { recursive: true, force: true })
  await mkdir(DIST_DIR, { recursive: true })

  const manifest = buildManifest(JSON.parse(await readFile(MANIFEST_PATH, "utf8")), origin)
  await writeIcons(manifest.icons)
  await writeFile(path.join(DIST_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  log("manifest", { name: manifest.name, version: manifest.version, hostPermissions: manifest.host_permissions })

  const options = {
    entryPoints: ENTRY_POINTS,
    outdir: DIST_DIR,
    bundle: true,
    format: "iife",
    target: "es2022",
    tsconfig: TSCONFIG_PATH,
    define: { __TRAVELINK_ORIGIN__: JSON.stringify(origin) },
    sourcemap: watch ? "inline" : false,
    logLevel: "info",
  }

  if (watch) {
    // Only the scripts rebuild on change. Restart after editing manifest.json or icons/icon.svg.
    const context = await esbuild.context(options)
    await context.watch()
    log("watching", { entryPoints: Object.keys(ENTRY_POINTS) })
    return
  }

  await esbuild.build(options)
  await checkManifestFiles(manifest)
  if (LOCAL_HOSTNAMES.has(new URL(origin).hostname)) {
    console.warn(`[ext:build] This build links to ${origin}. Set TRAVELINK_URL to travel-ink's https origin before zipping it for the Chrome Web Store.`)
  }
  log("done", { outDir: path.relative(process.cwd(), DIST_DIR) })
}

main().catch((error) => {
  console.error(`[ext:build] failed: ${error.message}`)
  process.exitCode = 1
})
