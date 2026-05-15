// =============================================================
// TIRO LIBRE MATEMÁTICO — App Entry
// Design: Pixel Champions (Brawl Stars + Nintendo + Pokémon)
// =============================================================

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import { GameProvider, useGame } from "./game/engine/GameContext";
import HomeScreen from "./game/screens/HomeScreen";
import LevelSelectScreen from "./game/screens/LevelSelectScreen";
import GameplayScreen from "./game/screens/GameplayScreen";
import VictoryScreen from "./game/screens/VictoryScreen";
import DefeatScreen from "./game/screens/DefeatScreen";
import ProgressScreen from "./game/screens/ProgressScreen";
import ProfileScreen from "./game/screens/ProfileScreen";
import TutorialScreen from "./game/screens/TutorialScreen";
import { AnimatePresence, motion } from "framer-motion";
import ErrorBoundary from "./components/ErrorBoundary";

function GameRouter() {
  const { state } = useGame();

  const screenMap: Record<string, React.ReactNode> = {
    home: <HomeScreen />,
    "level-select": <LevelSelectScreen />,
    gameplay: <GameplayScreen />,
    victory: <VictoryScreen />,
    defeat: <DefeatScreen />,
    progress: <ProgressScreen />,
    profile: <ProfileScreen />,
    tutorial: <TutorialScreen />,
    unlocks: <ProgressScreen />,
    rewards: <VictoryScreen />,
  };

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        minHeight: "100dvh",
        maxWidth: "430px",
        margin: "0 auto",
        position: "relative",
        background: "#1a1a2e",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={state.screen}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full"
          style={{ minHeight: "100dvh" }}
        >
          {screenMap[state.screen] ?? <HomeScreen />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <GameProvider>
            <GameRouter />
          </GameProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
