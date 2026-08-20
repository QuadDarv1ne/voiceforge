"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type ThemeOption = "light" | "dark" | "system";

const OPTIONS: { id: ThemeOption; label: string; icon: React.ReactNode }[] = [
  { id: "light", label: "Светлая", icon: <Sun className="h-4 w-4" /> },
  { id: "dark", label: "Тёмная", icon: <Moon className="h-4 w-4" /> },
  { id: "system", label: "Системная", icon: <Monitor className="h-4 w-4" /> },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const current = (mounted ? theme : "dark") as ThemeOption;
  const currentOption = OPTIONS.find((o) => o.id === current) ?? OPTIONS[1];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Переключить тему"
          className="rounded-full"
        >
          {mounted ? (
            currentOption.icon
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.id}
            onClick={() => setTheme(opt.id)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center",
                current === opt.id ? "opacity-100" : "opacity-0",
              )}
            >
              <Check className="h-3 w-3 text-primary" />
            </span>
            {opt.icon}
            <span>{opt.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
