// Points `apps/server/dist` inside an Electron app.asar at a modded build without
// repacking the archive: every file of the new dist is added to the header as
// `unpacked` (Electron then reads it from app.asar.unpacked), merged over the
// old entries so a running app can still load the hashed chunks it already
// references. All archive data bytes are kept as they are.
//
// Writes nothing inside the app: macOS App Management blocks non-Apple
// binaries run from launchd from writing into an app bundle. The caller copies
// <new-dist-dir> into app.asar.unpacked and moves <out-asar> over app.asar.
//
// usage: node asar-patch.mjs <app.asar> <new-dist-dir> <out-asar>
// @electron/asar does not export these; import its files by path.
import { readArchiveHeaderSync } from "../node_modules/@electron/asar/lib/disk.js";
import { Pickle } from "../node_modules/@electron/asar/lib/pickle.js";
import fs from "node:fs";
import path from "node:path";

const [asarPath, distDir, outPath] = process.argv.slice(2);
if (!asarPath || !distDir || !outPath) {
  console.error("usage: node asar-patch.mjs <app.asar> <new-dist-dir> <out-asar>");
  process.exit(2);
}

const DIST_PATH = ["apps", "server", "dist"];

/** A header subtree for `dir` with every file marked unpacked. */
function unpackedTree(dir) {
  const files = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files[entry.name] = unpackedTree(full);
    else if (entry.isFile()) files[entry.name] = { size: fs.statSync(full).size, unpacked: true };
  }
  return { files };
}

/** `next` over `prev`: new entries win, old entries the new build lacks stay. */
function merge(prev, next) {
  if (!prev?.files || !next.files) return next;
  const files = { ...prev.files };
  for (const [name, entry] of Object.entries(next.files)) files[name] = merge(prev.files[name], entry);
  return { ...prev, files };
}

const { header, headerSize } = readArchiveHeaderSync(asarPath);
let parent = header;
for (const segment of DIST_PATH.slice(0, -1)) {
  parent = parent.files?.[segment];
  if (!parent) throw new Error(`app.asar has no ${DIST_PATH.join("/")}`);
}
const leaf = DIST_PATH.at(-1);
if (!parent.files[leaf]) throw new Error(`app.asar has no ${DIST_PATH.join("/")}`);

parent.files[leaf] = merge(parent.files[leaf], unpackedTree(distDir));

const headerPickle = Pickle.createEmpty();
headerPickle.writeString(JSON.stringify(header));
const headerBuf = headerPickle.toBuffer();
const sizePickle = Pickle.createEmpty();
sizePickle.writeUInt32(headerBuf.length);
const sizeBuf = sizePickle.toBuffer();

const oldDataOffset = 8 + headerSize;
fs.mkdirSync(path.dirname(outPath), { recursive: true });
const out = fs.openSync(outPath, "w");
fs.writeSync(out, sizeBuf);
fs.writeSync(out, headerBuf);
const input = fs.openSync(asarPath, "r");
const chunk = Buffer.allocUnsafe(8 * 1024 * 1024);
let position = oldDataOffset;
for (;;) {
  const read = fs.readSync(input, chunk, 0, chunk.length, position);
  if (read === 0) break;
  fs.writeSync(out, chunk, 0, read);
  position += read;
}
fs.closeSync(input);
fs.closeSync(out);
console.log(`wrote ${outPath}: ${DIST_PATH.join("/")} read from app.asar.unpacked`);
