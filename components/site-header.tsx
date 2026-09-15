"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  LogIn,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { LoginDialog } from "@/components/login-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MAIN_NAV_LINKS } from "@/lib/nav";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, canViewDashboard, canViewPlayerDashboard } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-6">
          <Link
            href="/"
            className="font-heading shrink-0 text-sm font-semibold tracking-tight"
          >
            Shifty Player
          </Link>

          <nav aria-label="Main" className="flex flex-1 items-center gap-1 overflow-x-auto">
            {MAIN_NAV_LINKS.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href ||
                    pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            {canViewDashboard ? (
              <Link
                href="/dashboard"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted",
                  pathname.startsWith("/dashboard")
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                <LayoutDashboard className="size-3.5" aria-hidden />
                Admin
              </Link>
            ) : null}
            {canViewPlayerDashboard ? (
              <Link
                href="/player"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted",
                  pathname.startsWith("/player")
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                <LayoutDashboard className="size-3.5" aria-hidden />
                My Dashboard
              </Link>
            ) : null}
          </nav>

          <div className="ml-auto shrink-0">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-2",
                  )}
                  aria-label="Account menu"
                >
                  <Avatar size="sm">
                    <AvatarFallback className="text-[10px]">
                      {initials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline">{user.name}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{user.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {user.email}
                        </span>
                        <span className="text-xs capitalize text-muted-foreground">
                          {user.role}
                        </span>
                      </div>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  {canViewPlayerDashboard ? (
                    <DropdownMenuItem onClick={() => router.push("/player")}>
                      <LayoutDashboard />
                      My Dashboard
                    </DropdownMenuItem>
                  ) : null}
                  {canViewDashboard ? (
                    <DropdownMenuItem
                      onClick={() => router.push("/dashboard")}
                    >
                      <LayoutDashboard />
                      Admin Dashboard
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    onClick={() => {
                      void logout();
                    }}
                  >
                    <LogOut />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                type="button"
                data-testid="sign-in-button"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "gap-2",
                )}
                onClick={() => setLoginOpen(true)}
              >
                <LogIn className="size-4" aria-hidden />
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}
