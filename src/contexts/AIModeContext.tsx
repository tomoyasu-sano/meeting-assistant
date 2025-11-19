"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { AIMode } from "@/components/LiveSessionHeader";

type AIModeContextType = {
  aiMode: AIMode;
  setAIMode: (mode: AIMode) => void;
};

const AIModeContext = createContext<AIModeContextType | undefined>(undefined);

export function AIModeProvider({ children }: { children: ReactNode }) {
  const [aiMode, setAIMode] = useState<AIMode>("google_ai");

  return (
    <AIModeContext.Provider value={{ aiMode, setAIMode }}>
      {children}
    </AIModeContext.Provider>
  );
}

export function useAIMode() {
  const context = useContext(AIModeContext);
  if (context === undefined) {
    throw new Error("useAIMode must be used within an AIModeProvider");
  }
  return context;
}
