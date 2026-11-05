// Renames "T3 Code" to "DV³ Code" in the built bundles instead of in hundreds of
// upstream source strings, so syncs stay cheap. Phrases that mean upstream itself
// ("based on T3 Code", "upstream T3 Code", "T3 Code's privacy policy") keep the name.
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

const UPSTREAM_NAME = /(?<!based on |upstream |stock )T3 Code(?!\\?'s privacy policy)/g;
const BUNDLE_FILE = /\.(?:c|m)?js$|\.html$/;

export const rebrandProductName = (text: string) => text.replaceAll(UPSTREAM_NAME, "DV³ Code");

/** Rewrites every JS and HTML file under `directories`; returns how many changed. */
export const rebrandBuiltProductName = Effect.fn("rebrandBuiltProductName")(function* (
  directories: ReadonlyArray<string>,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let changed = 0;
  for (const directory of directories) {
    for (const file of yield* fs.readDirectory(directory, { recursive: true })) {
      if (!BUNDLE_FILE.test(file)) continue;
      const filePath = path.join(directory, file);
      const text = yield* fs.readFileString(filePath);
      const rebranded = rebrandProductName(text);
      if (rebranded === text) continue;
      yield* fs.writeFileString(filePath, rebranded);
      changed++;
    }
  }
  return changed;
});
