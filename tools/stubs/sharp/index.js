module.exports = function sharpStub() {
  throw new Error(
    "sharp is stubbed out for the Cloudflare build (see tools/stubs/sharp) — this should be unreachable because images.unoptimized is set.",
  );
};
