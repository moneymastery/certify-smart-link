import { describe, expect, it } from "vitest";
import { getBaselineOffset, getTextAnchorTop, getTextAnchorTransform } from "./certificate-layout";

describe("certificate text anchors", () => {
  it("keeps horizontal anchors stable across vertical modes", () => {
    expect(getTextAnchorTransform("left", "middle")).toBe("translate(0, -50%)");
    expect(getTextAnchorTransform("center", "top")).toBe("translate(-50%, 0)");
    expect(getTextAnchorTransform("right", "bottom")).toBe("translate(-100%, -100%)");
  });

  it("positions baseline by moving the top above the saved anchor", () => {
    expect(getTextAnchorTop(40, 20, "middle")).toBe("40%");
    expect(getTextAnchorTop(40, 20, "baseline")).toBe(`calc(40% - ${getBaselineOffset(20)}px)`);
  });
});