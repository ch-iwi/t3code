// fork(ch-iwi): renders the DV³ Code icons in assets/dv3 from assets/dv3/logo.png.
// Production sits on the DV³ navy; nightly and development reuse upstream's channel backgrounds
// (night sky, blueprint) so builds stay distinguishable. Upstream's icon pipeline
// (export-brand-icons.ts) is left untouched so it never overwrites these.
// Run with `node scripts/export-dv3-icons.ts` after changing the logo or colours.
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import sharp, { type OverlayOptions } from "sharp";

const OUTPUT_DIRECTORY = "assets/dv3";
const PRODUCTION_BACKGROUND = "#031E2F";
/** Logo width as a fraction of the icon body; a smaller logo reads as a smaller icon in the Dock. */
const LOGO_SCALE = 0.84;
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

export class Dv3IconRenderError extends Schema.TaggedError<Dv3IconRenderError>()(
  "Dv3IconRenderError",
  { icon: Schema.String, cause: Schema.Defect() },
) {}

interface Channel {
  /** File name prefix, e.g. `dv3-nightly` -> `dv3-nightly-macos-1024.png`. */
  readonly prefix: string;
  /** Upstream background layer (128px Icon Composer SVG); `undefined` is the solid DV³ navy. */
  readonly backgroundSvg?: string;
}

const CHANNELS: ReadonlyArray<Channel> = [
  { prefix: "dv3" },
  { prefix: "dv3-nightly", backgroundSvg: "assets/nightly/app-icon.icon/Assets/background.svg" },
  { prefix: "dv3-dev", backgroundSvg: "assets/dev/app-icon.icon/Assets/background.svg" },
];

function roundedSquare(size: number, inset: number, radius: number, fill: string): Buffer {
  const body = size - inset * 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect x="${inset}" y="${inset}" width="${body}" height="${body}" rx="${radius}" fill="${fill}"/></svg>`,
  );
}

/** The icon body: solid navy, or an upstream background stretched full bleed and clipped to our corners. */
async function renderBody(spec: IconSpec, backgroundSvg: string | undefined): Promise<Buffer> {
  const { size, inset, radius } = spec;
  if (backgroundSvg === undefined) {
    return roundedSquare(size, inset, radius, PRODUCTION_BACKGROUND);
  }
  const body = size - inset * 2;
  // Upstream clips its artwork to a 10px corner; drop that so our own mask decides the shape.
  const fullBleed = backgroundSvg.replace(
    /<rect width="128" height="128" rx="10"\/>/,
    '<rect width="128" height="128"/>',
  );
  const artwork = await sharp(Buffer.from(fullBleed), { density: (72 * body) / 128 })
    .resize(body, body)
    .png()
    .toBuffer();
  return sharp(roundedSquare(size, inset, radius, "#000"))
    .composite([{ input: artwork, top: inset, left: inset, blend: "in" }])
    .png()
    .toBuffer();
}

interface IconSpec {
  readonly size: number;
  /** Transparent margin around the body; 0 is full bleed. */
  readonly inset: number;
  readonly radius: number;
  readonly shadow?: boolean;
}

/** Logo centred on a rounded square, optionally with the macOS drop shadow. */
async function renderIcon(
  logoPath: string,
  spec: IconSpec,
  backgroundSvg: string | undefined,
): Promise<Buffer> {
  const { size, inset, radius } = spec;
  const logo = await sharp(logoPath)
    .trim()
    .resize({ width: Math.round((size - inset * 2) * LOGO_SCALE) })
    .png()
    .toBuffer({ resolveWithObject: true });
  const layers: OverlayOptions[] = [];
  if (spec.shadow) {
    const shadow = await sharp(roundedSquare(size, inset, radius, "#000"))
      .linear(0, 0)
      .ensureAlpha(0.35)
      .blur(size / 64)
      .png()
      .toBuffer();
    layers.push({ input: shadow, top: Math.round(size / 80), left: 0 });
  }
  layers.push({ input: await renderBody(spec, backgroundSvg), top: 0, left: 0 });
  layers.push({
    input: logo.data,
    top: Math.round((size - logo.info.height) / 2),
    left: Math.round((size - logo.info.width) / 2),
  });
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(layers)
    .png()
    .toBuffer();
}

/** ICO file whose entries are PNG-encoded, the same layout upstream's icons use. */
function encodeIco(images: ReadonlyArray<{ size: number; png: Buffer }>): Buffer {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.png)]);
}

const rounded = (size: number): IconSpec => ({
  size,
  inset: 0,
  radius: Math.round(size * 0.2237),
});

const PNG_ICONS: ReadonlyArray<readonly [string, IconSpec]> = [
  // macOS pre-Tahoe safe area: an 824px body inset 100px, with a soft shadow below.
  ["macos-1024.png", { size: 1024, inset: 100, radius: 185, shadow: true }],
  // iOS masks the corners itself, so this one is a full-bleed square.
  ["ios-1024.png", { size: 1024, inset: 0, radius: 0 }],
  ["universal-1024.png", rounded(1024)],
  ["web-apple-touch-180.png", rounded(180)],
  ["web-favicon-16x16.png", rounded(16)],
  ["web-favicon-32x32.png", rounded(32)],
];

const render = (
  logoPath: string,
  icon: string,
  spec: IconSpec,
  backgroundSvg: string | undefined,
) =>
  Effect.tryPromise({
    try: () => renderIcon(logoPath, spec, backgroundSvg),
    catch: (cause) => new Dv3IconRenderError({ icon, cause }),
  });

const exportDv3Icons = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repositoryRoot = path.resolve(import.meta.dirname, "..");
  const outputDirectory = path.join(repositoryRoot, OUTPUT_DIRECTORY);
  const logoPath = path.join(outputDirectory, "logo.png");

  const outputs: Array<readonly [string, Buffer]> = [];
  for (const channel of CHANNELS) {
    const backgroundSvg =
      channel.backgroundSvg === undefined
        ? undefined
        : yield* fs.readFileString(path.join(repositoryRoot, channel.backgroundSvg));
    for (const [suffix, spec] of PNG_ICONS) {
      const name = `${channel.prefix}-${suffix}`;
      outputs.push([name, yield* render(logoPath, name, spec, backgroundSvg)]);
    }
    const icoImages = yield* Effect.forEach(ICO_SIZES, (size) =>
      render(logoPath, `${channel.prefix}-ico-${size}`, rounded(size), backgroundSvg).pipe(
        Effect.map((png) => ({ size, png })),
      ),
    );
    outputs.push([`${channel.prefix}-windows.ico`, encodeIco(icoImages)]);
    outputs.push([
      `${channel.prefix}-web-favicon.ico`,
      encodeIco(icoImages.filter((image) => image.size <= 48)),
    ]);
  }

  for (const [name, contents] of outputs) {
    yield* fs.writeFile(path.join(outputDirectory, name), contents);
    yield* Console.log(`wrote ${OUTPUT_DIRECTORY}/${name}`);
  }
});

if (import.meta.main) {
  exportDv3Icons.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
}
