"use client";

import { useState, type ReactNode } from "react";

export function AdminManageTabs({ roster, categories, accounts }: { roster: ReactNode; categories: ReactNode; accounts: ReactNode }) {
  const [tab, setTab] = useState<"roster" | "categories" | "accounts">("roster");
  const tabs = [
    { id: "roster" as const, label: "Rosters" },
    { id: "categories" as const, label: "Point categories" },
    { id: "accounts" as const, label: "Accounts and profiles" }
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-md border border-court-line bg-court-panel p-2 shadow-sm" role="tablist" aria-label="Team management area">
        {tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`rounded-md px-4 text-sm font-medium ${tab === item.id ? "bg-white text-black" : "text-zinc-600 hover:bg-court-elevated"}`} role="tab" aria-selected={tab === item.id}>{item.label}</button>)}
      </div>
      <div role="tabpanel">{tab === "roster" ? roster : tab === "categories" ? categories : accounts}</div>
    </div>
  );
}
