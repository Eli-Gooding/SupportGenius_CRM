"use client";

import { AIChatContainer } from "./ai-chat-container";

interface AIChatLayoutProps {
  children: React.ReactNode;
}

export function AIChatLayout({ children }: AIChatLayoutProps) {
  return (
    <div className="relative min-h-screen">
      {children}
      <AIChatContainer className="print:hidden" />
    </div>
  );
} 