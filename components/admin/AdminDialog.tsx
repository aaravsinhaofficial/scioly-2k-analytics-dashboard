"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminDialogProps {
  labelledBy: string;
  describedBy?: string;
  onClose: () => void;
  children: ReactNode;
  initialFocusRef?: { current: HTMLElement | null };
  closeDisabled?: boolean;
  busy?: boolean;
  placement?: "center" | "bottom";
  panelClassName?: string;
}

/**
 * Modal foundation for admin workflows. Native `showModal()` provides focus
 * containment and makes the rest of the page inert while the dialog is open.
 */
export function AdminDialog({
  labelledBy,
  describedBy,
  onClose,
  children,
  initialFocusRef,
  closeDisabled = false,
  busy = false,
  placement = "center",
  panelClassName,
}: AdminDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    const frame = window.requestAnimationFrame(() => initialFocusRef?.current?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      if (dialog.open) dialog.close();
      window.requestAnimationFrame(() => {
        if (previousFocus?.isConnected) previousFocus.focus();
        else document.querySelector<HTMLElement>("#main-content")?.focus();
      });
    };
  }, [initialFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-busy={busy || undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!closeDisabled) onClose();
      }}
      className={cn(
        "fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none border-0 bg-transparent p-4 text-white backdrop:bg-[rgb(7_18_13_/_0.65)] backdrop:backdrop-blur-sm",
        placement === "bottom" ? "items-end justify-center open:flex sm:items-center" : "place-items-center open:grid",
      )}
    >
      <div
        className={cn(
          "max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-md border border-court-line bg-court-panel shadow-panel",
          panelClassName,
        )}
      >
        {children}
      </div>
    </dialog>
  );
}
