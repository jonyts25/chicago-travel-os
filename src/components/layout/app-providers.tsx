"use client";

import type { ReactNode } from "react";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { ToastProvider } from "@/components/ui/toast-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex min-h-full flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
      <BottomTabBar />
    </ToastProvider>
  );
}
