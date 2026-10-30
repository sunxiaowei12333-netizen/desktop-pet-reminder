import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

// Legacy .icns files on macOS 15 do not receive a system corner mask.
// The 1024px canvas includes a centered 824px continuous-corner silhouette.
const output = path.resolve(process.argv[2] || "release/RestMoment.iconset");
mkdirSync(output, { recursive: true });
const artwork = await sharp("assets/logo.png").resize(824, 824).png().toBuffer();
const icon = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: "#00000000" } })
  .composite([{ input: artwork, left: 100, top: 100 }]).png().toBuffer();
const alpha = await sharp("assets/macos-legacy-mask.png").extractChannel(0).raw().toBuffer();
const rgb = await sharp(icon).removeAlpha().png().toBuffer();
const masked = await sharp(rgb).joinChannel(alpha, { raw: { width: 1024, height: 1024, channels: 1 } }).png().toBuffer();
await sharp(masked).toFile("assets/RestMoment.png");
for (const size of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) {
    await sharp(masked).resize(size * scale, size * scale)
      .toFile(path.join(output, `icon_${size}x${size}${scale === 2 ? "@2x" : ""}.png`));
  }
}
execFileSync("iconutil", ["-c", "icns", output, "-o", "assets/RestMoment.icns"], { stdio: "inherit" });
console.log("Built macOS icon: 1024px canvas, 824px artwork, transparent margins and continuous corners.");
