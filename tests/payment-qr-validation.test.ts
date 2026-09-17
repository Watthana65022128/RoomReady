import assert from "node:assert/strict";
import test from "node:test";
import { qrImageType, QR_MAX_BYTES } from "../src/lib/payment-qr-validation.ts";
test("QR rejects SVG, HTML and truncated raster headers", () => {
  for (const s of [
    "<svg onload=alert(1)>",
    "<html>fake.png</html>",
    "not an image",
  ])
    assert.equal(qrImageType(new TextEncoder().encode(s)), null);
  assert.equal(
    qrImageType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])),
    null,
  );
  assert.equal(QR_MAX_BYTES, 2097152);
});
test("QR accepts supported raster signatures", () => {
  assert.equal(
    qrImageType(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    ),
    "image/png",
  );
  assert.equal(
    qrImageType(new Uint8Array([255, 216, 255, 224, 0, 0, 0, 0, 0, 0, 0, 0])),
    "image/jpeg",
  );
  assert.equal(
    qrImageType(new TextEncoder().encode("RIFF0000WEBP")),
    "image/webp",
  );
});
