"use client";

import { ReactNode } from "react";
import { AIModeProvider } from "@/contexts/AIModeContext";

/**
 * LiveSessionのクライアントコンテナ
 * AIモード状態をヘッダーとパネル間で共有するためのProvider
 */
export function LiveSessionContainer({ children }: { children: ReactNode }) {
  return <AIModeProvider>{children}</AIModeProvider>;
}
