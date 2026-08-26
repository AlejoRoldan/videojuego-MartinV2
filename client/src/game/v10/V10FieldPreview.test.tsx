import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import V10FieldPreview from "./V10FieldPreview";

describe("V10 field preview", () => {
  it("renders a football-first scene without coordinate targeting", () => {
    const html = renderToStaticMarkup(<V10FieldPreview />);
    expect(html).toContain("Cancha V10");
    expect(html).toContain("Cancha de fútbol a escala real");
    expect(html).toContain("DISPARAR");
    expect(html.toLowerCase()).not.toContain("coordenada");
    expect(html).not.toMatch(/Apuntar a coordenada/);
    expect(html).not.toMatch(/\(-?\d+,\s*-?\d+\)/);
    expect(html.match(/<option/g)).toHaveLength(10);
  });
});
