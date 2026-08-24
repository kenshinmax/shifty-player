import Link from "next/link";
import { MAIN_NAV_LINKS } from "@/lib/nav";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t bg-muted/30">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-3 sm:col-span-2 lg:col-span-1">
          <Link
            href="/"
            className="font-heading text-sm font-semibold tracking-tight"
          >
            Shifty Player
          </Link>
          <p className="max-w-xs text-sm text-muted-foreground">
            Basketball programs, clinics, and showcases — built to help players
            find the right path and register with confidence.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Explore
          </p>
          <nav aria-label="Footer" className="flex flex-col gap-2">
            {MAIN_NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-foreground/80 transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Contact
          </p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <a
                href="mailto:hello@shiftyplayer.com"
                className="text-foreground/80 transition-colors hover:text-foreground"
              >
                hello@shiftyplayer.com
              </a>
            </p>
            <p>Questions about registration? Reach out anytime.</p>
          </div>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Shifty Player. All rights reserved.</p>
          <p>Train harder · Play smarter · Be elite</p>
        </div>
      </div>
    </footer>
  );
}
