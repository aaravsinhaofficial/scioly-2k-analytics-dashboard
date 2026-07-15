"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type ManageTab = "roster" | "points" | "categories" | "accounts";

export function AdminManageTabs({ roster, points, categories, accounts, initialTab = "roster" }: { roster: ReactNode; points: ReactNode; categories: ReactNode; accounts: ReactNode; initialTab?: ManageTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<ManageTab>(initialTab);
  const tabs = [
    { id: "roster" as const, label: "Rosters" },
    { id: "points" as const, label: "Points" },
    { id: "categories" as const, label: "Point categories" },
    { id: "accounts" as const, label: "People" }
  ];

  useEffect(() => setTab(initialTab), [initialTab]);

  function chooseTab(nextTab: ManageTab) {
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const panel = tab === "roster" ? roster : tab === "points" ? points : tab === "categories" ? categories : accounts;
  const selectedLabel = tabs.find((item) => item.id === tab)?.label ?? "Management";
  return (
    <div className="space-y-4">
      <div className="flex max-w-full flex-wrap gap-2 rounded-md border border-court-line bg-court-panel p-2 shadow-sm" role="group" aria-label="Choose a team management area">
        {tabs.map((item) => <button key={item.id} type="button" onClick={() => chooseTab(item.id)} aria-pressed={tab === item.id} className={`rounded-md px-4 text-sm font-medium ${tab === item.id ? "bg-white text-black" : "text-zinc-600 hover:bg-court-elevated"}`}>{item.label}</button>)}
      </div>
      <section aria-labelledby="admin-manage-panel-heading">
        <h2 id="admin-manage-panel-heading" className="sr-only">{selectedLabel}</h2>
        {panel}
      </section>
    </div>
  );
}
