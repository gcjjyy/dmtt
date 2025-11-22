import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface GameStatusContextType {
  statusMessage: string;
  setStatusMessage: (message: string) => void;
}

const GameStatusContext = createContext<GameStatusContextType | undefined>(undefined);

export function GameStatusProvider({ children }: { children: ReactNode }) {
  const [statusMessage, setStatusMessage] = useState("");

  return (
    <GameStatusContext.Provider value={{ statusMessage, setStatusMessage }}>
      {children}
    </GameStatusContext.Provider>
  );
}

export function useGameStatus() {
  const context = useContext(GameStatusContext);
  if (context === undefined) {
    throw new Error("useGameStatus must be used within a GameStatusProvider");
  }
  return context;
}
