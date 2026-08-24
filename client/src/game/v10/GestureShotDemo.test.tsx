import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GestureShotDemo from "./GestureShotDemo";

describe("V10 gesture demo", () => {
  it("renders persistent table progression without coordinates", () => {
    const html = renderToStaticMarkup(<GestureShotDemo />);
    expect(html).toContain("Domina y avanza");
    expect(html).toContain("ACADEMIA DE TABLAS");
    expect(html).toContain("Tablas 2–5");
    expect(html).toContain("Tablas 6–9");
    expect(html).toContain("CAMINO A TABLAS 6–9");
    expect(html).toContain("Descubriendo");
    expect(html).toContain("🔒");
    expect(html).toContain("Primero calcula");
    expect(html).toContain("Arco libre");
    expect(html).toContain("Barrera");
    expect(html).toContain("Arquero");
    expect(html).toContain('data-swipe-surface="true"');
    expect(html.toLowerCase()).not.toContain("coordenada");
    expect(html).not.toMatch(/\(-?\d+,\s*-?\d+\)/);
  });
});
