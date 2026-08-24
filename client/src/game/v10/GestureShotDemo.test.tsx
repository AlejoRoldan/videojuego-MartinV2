import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GestureShotDemo from "./GestureShotDemo";

describe("V10 gesture demo", () => {
  it("renders adaptive table progression without coordinates", () => {
    const html = renderToStaticMarkup(<GestureShotDemo />);
    expect(html).toContain("Mejora con cada tiro");
    expect(html).toContain("ACADEMIA DE TABLAS · ADAPTATIVA");
    expect(html).toContain("Modo adaptativo: Explorando");
    expect(html).toContain("Descubre una combinación nueva");
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
