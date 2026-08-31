import { AnimatePresence, motion } from "framer-motion";
import { GameProvider, useGame } from "./engine/GameContext";
import DefeatScreen from "./screens/DefeatScreen";
import GameplayScreen from "./screens/GameplayScreen";
import HomeScreen from "./screens/HomeScreen";
import LevelSelectScreen from "./screens/LevelSelectScreen";
import MathPowerOverlay from "./screens/MathPowerOverlay";
import ProfileScreen from "./screens/ProfileScreen";
import ProgressScreen from "./screens/ProgressScreen";
import TutorialScreen from "./screens/TutorialScreen";
import VictoryScreen from "./screens/VictoryScreen";

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
    <div className="w-full overflow-hidden" style={{ minHeight: "100dvh", maxWidth: "430px", margin: "0 auto", position: "relative", background: "#1a1a2e" }}>
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
      <MathPowerOverlay />
    </div>
  );
}

export default function LegacyGame() {
  return (
    <GameProvider>
      <GameRouter />
    </GameProvider>
  );
}
