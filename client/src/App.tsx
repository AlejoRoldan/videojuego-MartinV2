// =============================================================
// TIRO LIBRE MATEMÁTICO — App Entry
// Design: Pixel Champions (Brawl Stars + Nintendo + Pokémon)
// =============================================================

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";

const GestureShotDemo = lazy(() => import("./game/v10/GestureShotDemo"));
const LegacyGame = lazy(() => import("./game/LegacyGame"));
const ShotPhysicsLab = lazy(() => import("./game/v10/ShotPhysicsLab"));
const V10FieldPreview = lazy(() => import("./game/v10/V10FieldPreview"));

function LoadingGame() {
  return (
    <div role="status" aria-live="polite" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#07131f", color: "#dce8e1", fontWeight: 900 }}>
      Preparando el estadio…
    </div>
  );
}

function App() {
  const searchParams = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  const showPhysicsLab = searchParams.get("physicsLab") === "1";
  const showV10Preview = searchParams.get("v10Preview") === "1";
  const showLegacyGame = searchParams.get("legacy") === "1";

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<LoadingGame />}>
            {showV10Preview ? (
              <V10FieldPreview />
            ) : showPhysicsLab ? (
              <ShotPhysicsLab />
            ) : showLegacyGame ? (
              <LegacyGame />
            ) : (
              <GestureShotDemo />
            )}
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
