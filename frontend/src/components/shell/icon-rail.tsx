"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeModes } from "@/components/theme-modes";

type IconProps = { className?: string };

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function PlusIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE} strokeWidth={2.2}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.3-4.3" />
    </svg>
  );
}

function HomeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

function FolderIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <path d="M3 7a1 1 0 0 1 1-1h5l2 2.5h8a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

function GlobeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4c2 2.4 3 5 3 8s-1 5.6-3 8c-2-2.4-3-5-3-8s1-5.6 3-8Z" />
    </svg>
  );
}

function ChatIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <path d="M4 5h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8l-4 3Z" />
      <path d="M18 9h2a1 1 0 0 1 1 1v6l-3-2.2h-5a1 1 0 0 1-1-1v-.3" />
    </svg>
  );
}

function SmileIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M9 10h.01M15 10h.01M9 14.5c.8.7 1.8 1 3 1s2.2-.3 3-1" />
    </svg>
  );
}

function HelpIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.5 2.5 0 0 1 4.9.6c0 1.7-2.5 2-2.5 3.5M12 17h.01" />
    </svg>
  );
}

function ProfileIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <circle cx="10" cy="8.5" r="3.5" />
      <path d="M3.5 20a6.5 6.5 0 0 1 11-4.7M17 17.5l3.5-3.5-1.5-1.5L15.5 16v1.5Z" />
    </svg>
  );
}

function KeyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v3M15.5 12v2.5" />
    </svg>
  );
}

function ShieldIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <path d="M12 3.5 19 6v6c0 4-3 7-7 8.5C8 19 5 16 5 12V6Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function PowerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <path d="M12 3.5v7.5M7.5 6.5a7 7 0 1 0 9 0" />
    </svg>
  );
}

type RailItem = {
  key: string;
  label: string;
  icon: (props: IconProps) => React.ReactElement;
  href?: string;
  /** Sections that do not exist yet are shown dimmed rather than as dead links. */
  built: boolean;
  /** Whether the current path belongs to this section. */
  matches?: (pathname: string) => boolean;
};

const ITEMS: RailItem[] = [
  // Me is the workspace root, so it matches that one path and nothing below it.
  { key: "me", label: "Me", icon: HomeIcon, href: "/", built: true, matches: (path) => path === "/" },
  {
    key: "projects",
    label: "Projects",
    icon: FolderIcon,
    href: "/projects",
    built: true,
    matches: (path) => path.startsWith("/projects"),
  },
  { key: "everything", label: "Everything", icon: GlobeIcon, built: false },
  { key: "chat", label: "Chat", icon: ChatIcon, built: false },
];

const BOTTOM_ITEMS: RailItem[] = [
  { key: "feedback", label: "Feedback", icon: SmileIcon, built: false },
  { key: "help", label: "Help", icon: HelpIcon, built: false },
];

function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/**
 * The workspace rail: the one piece of navigation present on every signed-in
 * page, so Projects is always a click away wherever you are.
 *
 * Sections that are not built yet still appear, dimmed and inert, so the shape
 * of the product is visible without pretending the links work.
 */
export function IconRail({
  fullName,
  organizationName,
  canCreateProject,
  canManageRoles,
}: {
  fullName: string;
  organizationName: string;
  canCreateProject: boolean;
  canManageRoles: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 z-30 flex h-dvh w-16 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface py-3">
      {canCreateProject ? (
        <Link
          href="/projects?new=1"
          title="New project"
          aria-label="New project"
          className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <PlusIcon className="size-5" />
        </Link>
      ) : null}

      <RailButton label="Search" icon={SearchIcon} />

      <hr className="my-2 w-8 border-t border-border" />

      <nav aria-label="Workspace" className="flex flex-col items-center gap-1">
        {ITEMS.map((item) => (
          <RailEntry key={item.key} item={item} active={item.matches?.(pathname) ?? false} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-1">
        {BOTTOM_ITEMS.map((item) => (
          <RailButton key={item.key} label={item.label} icon={item.icon} />
        ))}

        <AccountMenu
          fullName={fullName}
          organizationName={organizationName}
          canManageRoles={canManageRoles}
        />
      </div>
    </aside>
  );
}

const ENTRY_CLASS = "flex w-14 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px]";

function RailEntry({ item, active }: { item: RailItem; active: boolean }) {
  const Icon = item.icon;

  if (!item.built || !item.href) {
    return <RailButton label={item.label} icon={item.icon} />;
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`${ENTRY_CLASS} transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
        active
          ? "font-medium text-primary"
          : "text-muted hover:bg-surface-strong hover:text-foreground"
      }`}
    >
      <span
        className={`flex size-9 items-center justify-center rounded-xl transition-colors ${
          active ? "bg-primary/15 ring-1 ring-primary/40" : ""
        }`}
      >
        <Icon className="size-5" />
      </span>
      {item.label}
    </Link>
  );
}

/** A rail slot for something that is not built yet: visible, labelled, inert. */
function RailButton({ label, icon: Icon }: { label: string; icon: (props: IconProps) => React.ReactElement }) {
  return (
    <span aria-disabled title={`${label} — not built yet`} className={`${ENTRY_CLASS} cursor-default text-muted/45`}>
      <span className="flex size-9 items-center justify-center rounded-xl">
        <Icon className="size-5" />
      </span>
      {label}
    </span>
  );
}

/**
 * Who you are signed in as, with the controls that used to sit in each page
 * header. The rail is on every page, so they only need to exist once.
 */
function AccountMenu({
  fullName,
  organizationName,
  canManageRoles,
}: {
  fullName: string;
  organizationName: string;
  canManageRoles: boolean;
}) {
  const menu = useRef<HTMLDetailsElement>(null);

  function closeMenu() {
    if (menu.current) menu.current.open = false;
  }

  // A menu that only closes by clicking the avatar again feels stuck, so
  // anywhere else and Escape close it too.
  useEffect(() => {
    function close(event: MouseEvent | KeyboardEvent) {
      const element = menu.current;
      if (!element?.open) return;
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && element.contains(event.target as Node)) return;
      element.open = false;
    }

    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <details ref={menu} className="relative mt-1">
      <summary
        title={`${fullName} · ${organizationName}`}
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full bg-surface-strong text-xs font-semibold text-foreground ring-1 ring-border transition-colors hover:ring-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {initialsOf(fullName)}
      </summary>

      <div className="absolute bottom-0 left-full z-40 ml-2 w-64 rounded-xl border border-border bg-background p-1.5 shadow-xl">
        <div className="flex items-center gap-3 px-2.5 py-2.5">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-strong text-xs font-semibold ring-1 ring-border"
          >
            {initialsOf(fullName)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{fullName}</span>
            <span className="block truncate text-xs text-muted">{organizationName}</span>
          </span>
        </div>

        <Divider />

        <MenuLink href="/settings/profile" icon={ProfileIcon} onNavigate={closeMenu}>
          Profile
        </MenuLink>
        <MenuLink href="/settings/profile#change-password" icon={KeyIcon} onNavigate={closeMenu}>
          Change password
        </MenuLink>
        {canManageRoles ? (
          <MenuLink href="/settings/roles" icon={ShieldIcon} onNavigate={closeMenu}>
            Roles &amp; permissions
          </MenuLink>
        ) : null}

        <Divider />

        <p className="px-2.5 pt-1.5 text-[11px] tracking-wide text-muted">Mode</p>
        <ThemeModes />

        <Divider />

        <SignOutButton
          className={`${MENU_ROW_CLASS} w-full text-muted hover:bg-surface-strong hover:text-foreground`}
          icon={<PowerIcon className="size-4 shrink-0" />}
          label="Log out"
        />
      </div>
    </details>
  );
}

const MENU_ROW_CLASS =
  "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function Divider() {
  return <hr className="my-1 border-t border-border" />;
}

function MenuLink({
  href,
  icon: Icon,
  onNavigate,
  children,
}: {
  href: string;
  icon: (props: IconProps) => React.ReactElement;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`${MENU_ROW_CLASS} text-muted hover:bg-surface-strong hover:text-foreground`}
    >
      <Icon className="size-4 shrink-0" />
      {children}
    </Link>
  );
}
