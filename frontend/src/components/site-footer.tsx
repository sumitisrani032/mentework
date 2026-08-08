import Link from "next/link";

import { Logo } from "@/components/logo";
import { Container } from "@/components/ui/section";
import { FOOTER_COLUMNS } from "@/lib/content";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted">
              One place for your projects, teams and conversations.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold">{column.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((label) => (
                  <li key={label}>
                    <Link
                      href="#"
                      className="text-sm text-muted transition-colors hover:text-foreground"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Mentework. All rights reserved.</p>
          <Link href="/status" className="transition-colors hover:text-foreground">
            System status
          </Link>
        </div>
      </Container>
    </footer>
  );
}
