import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GestureShotDemo from "./GestureShotDemo";

describe("V10 gesture demo", () => {
  it("renders the two-gesture football interaction without coordinates", () => {
    const html = renderToStaticMarkup(<GestureShotDemo />);
    expect(html).toContain("Controla el tiro");
    expect(html).toContain("Desliza el balón hacia el arco");
    expect(html).toContain("La rapidez controla la fuerza");
    expect(html).toContain('data-swipe-surface="true"');
    expect(html.toLowerCase()).not.toContain("coordenada");
    expect(html).not.toMatch(/\(-?\d+,\s*-?\d+\)/);
  });
});
