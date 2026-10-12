"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { THEME_KEY } from "@/lib/theme";

// The icon is chosen by CSS (the "dark" class on the page), so this button needs no state.
export function ThemeToggle() {
  function toggle() {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      window.localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {
      // Storage can be blocked. The choice then lasts until the page closes.
    }
  }
  return (
    <Button variant="outline" size="icon" onClick={toggle} aria-label="Switch between light and dark theme" title="Switch theme">
      <Moon className="size-4 dark:hidden" aria-hidden="true" />
      <Sun className="hidden size-4 dark:block" aria-hidden="true" />
    </Button>
  );
}
