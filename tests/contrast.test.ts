import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
it("primary buttons meet AA contrast for white small text in both themes", () => {
  const css = readFileSync(
    "src/theme/theme.css",
    "utf8",
  );
  const colors = [...css.matchAll(/--primary:\s*(#[a-f\d]{6})/gi)].map(
    (m) => m[1],
  );
  expect(colors).toHaveLength(2);
  for (const color of colors) {
    const channels = color
      .slice(1)
      .match(/../g)!
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    const luminance =
      channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(4.5);
  }
});
