"use client";

import { Printer } from "lucide-react";

export function PrintPracticeButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200 print:hidden"
    >
      <Printer className="h-4 w-4" aria-hidden="true" />
      Print test
    </button>
  );
}
