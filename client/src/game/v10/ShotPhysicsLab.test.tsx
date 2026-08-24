import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ShotPhysicsLab from "./ShotPhysicsLab";

describe("V10 shot physics lab", () => {
  it("renders the calibrated physical controls and projections", () => {
    const html = renderToStaticMarkup(<ShotPhysicsLab />);
    expect(html).toContain("Laboratorio de física del tiro");
    expect(html).toContain("Velocidad");
    expect(html).toContain("Elevación");
    expect(html).toContain("Efecto lateral");
    expect(html).toContain("Vista lateral");
    expect(html).toContain("Vista superior");
    expect(html).toContain("GOL");
    expect(html.match(/<option/g)).toHaveLength(10);
  });
});
