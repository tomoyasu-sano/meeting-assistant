"use client";

import { useState } from "react";
import { DesktopNav } from "@/components/DesktopNav";
import { MobileNav } from "@/components/MobileNav";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { UserMenu } from "@/components/UserMenu";
import { SignOutButton } from "./SignOutButton";

type NavItem = {
  href: string;
  label: string;
};

type LayoutClientProps = {
  navigation: NavItem[];
  brandName: string;
  userEmail: string;
  children: React.ReactNode;
};

export function LayoutClient({
  navigation,
  brandName,
  userEmail,
  children,
}: LayoutClientProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen mesh-bg grid-pattern">
      {/* デスクトップサイドバー */}
      <div
        className={`hidden md:block transition-all duration-300 ${
          isSidebarOpen ? "w-48" : "w-0"
        }`}
      >
        {isSidebarOpen && (
          <DesktopNav navigation={navigation} brandName={brandName} />
        )}
      </div>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-2 md:gap-4 border-b border-indigo-100 bg-white md:bg-white/80 md:backdrop-blur-sm px-3 py-4 md:px-6 sticky top-0 z-50">
          {/* ハンバーガーメニューボタン（デスクトップ用） */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden md:block rounded-lg p-2 hover:bg-indigo-50 transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg
              className="h-6 w-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isSidebarOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>

          {/* モバイルナビゲーション（ハンバーガーボタン含む） */}
          <MobileNav navigation={navigation} brandName={brandName} />

          <div className="flex flex-1 items-center justify-end gap-1 md:gap-4">
            <LanguageSwitcher />
            <UserMenu email={userEmail} />
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
