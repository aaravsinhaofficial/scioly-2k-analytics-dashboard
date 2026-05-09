import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { UserRole } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("en-US", options).format(value);
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(date));
}

export function toInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const roleRank: Record<UserRole, number> = {
  viewer: 0,
  officer: 1,
  admin: 2
};

export function roleMeets(role: UserRole, minimum: UserRole) {
  return roleRank[role] >= roleRank[minimum];
}

export function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export function csvEscape(value: string | number | undefined) {
  if (value === undefined) return "";
  const text = String(value);
  return /[,"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
