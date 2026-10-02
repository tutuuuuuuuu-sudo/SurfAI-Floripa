import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// localStorage seguro — não quebra em modo privado (Safari/Firefox) nem com quota excedida
export function lsGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

export function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* quota ou modo privado */ }
}

export function lsRemove(key: string): void {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

export function lsGetJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch { return fallback }
}

export function lsSetJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota ou modo privado */ }
}
