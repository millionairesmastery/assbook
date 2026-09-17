"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { Toaster } from "sonner";
import { Bell, Check, Code2, LogOut, Pencil, Plus, Sparkles, Video } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/assbook/avatar";
import { SearchField } from "@/components/assbook/search-field";
import { mobileNavItems, navItems } from "@/components/assbook/nav-items";
import { legalLinks, SOURCE_URL } from "@/components/assbook/landing/site-links";
import type { Profile } from "@/lib/types";

export type AppShellProps = {
  user: Profile | null;
  /** The nav item to highlight, or "" while visiting somebody else. */
  view: string;
  search: string;
  searchPeople: Profile[];
  searched: boolean;
  onSearch: (next: string) => void;
  onChooseView: (view: string) => void;
  onVisitProfile: (handle: string) => void;
  onEditProfile: () => void;
  onOpenSecurity: () => void;
  onOpenBlocked: () => void;
  onOpenModeration: () => void;
  /** Unread notifications, shown on the bell. */
  unread: number;
  onOpenNotifications: () => void;
  onSignOut: () => void;
  onJoin: () => void;
  onSignIn: () => void;
  onOpenRules: () => void;
  onOpenSource: () => void;
  onCompose: () => void;
  /** Only offered to signed-in members: the strip's camera control on a phone. */
  onPostPeek?: () => void;
  onFocusSearch: () => void;
  rail: ReactNode;
  children: ReactNode;
};

export function AppShell({
  user,
  view,
  search,
  searchPeople,
  searched,
  onSearch,
  onChooseView,
  onVisitProfile,
  onEditProfile,
  onOpenSecurity,
  onOpenBlocked,
  onOpenModeration,
  unread,
  onOpenNotifications,
  onSignOut,
  onJoin,
  onSignIn,
  onOpenRules,
  onOpenSource,
  onCompose,
  onPostPeek,
  onFocusSearch,
  rail,
  children,
}: AppShellProps) {
  return (
    <SidebarProvider>
      <div className="app-shell">
        <Toaster position="bottom-center" richColors />
        <a className="skip-link" href="#main-content">
          Skip to the posts
        </a>
        <header className="topbar">
          <Link
            className="brand"
            href="/"
            onClick={(event) => {
              event.preventDefault();
              onChooseView("feed");
            }}
          >
            <span className="brandmark" aria-hidden="true">
              🍑
            </span>
            assbook
            <span className="beta">BETA</span>
          </Link>
          <SearchField
            value={search}
            onChange={onSearch}
            variant="topbar"
            people={searchPeople}
            searched={searched}
            onSelectPerson={onVisitProfile}
          />
          {user ? (
            <>
            <button
              className="bell-button"
              onClick={onOpenNotifications}
              aria-label={
                unread > 0
                  ? "Notifications, " + unread + " unread"
                  : "Notifications"
              }
            >
              <Bell size={20} aria-hidden="true" />
              {unread > 0 && (
                <span className="bell-count" aria-hidden="true">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="join-button">
                  <Avatar person={user} />
                  <span>@{user.handle}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onVisitProfile(user.handle)}>
                  Your profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEditProfile}>
                  Edit profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenSecurity}>
                  Account security
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenBlocked}>
                  Blocked accounts
                </DropdownMenuItem>
                {user.isAdmin && (
                  <DropdownMenuItem onClick={onOpenModeration}>
                    Moderation queue
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onSignOut}>
                  <LogOut size={15} />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          ) : (
            <div className="top-auth">
              <button className="join-button" onClick={onJoin}>
                Join
              </button>
              <button className="join-button" onClick={onSignIn}>
                Sign in
              </button>
            </div>
          )}
        </header>
        <div className="three-columns">
          <Sidebar collapsible="none" className="leftnav">
            <SidebarContent>
              <div className="nav-label">YOUR LITTLE CORNER</div>
              <SidebarMenu>
                {navItems.map(({ icon: Icon, label, view: next }) => (
                  <SidebarMenuItem key={label}>
                    <SidebarMenuButton
                      className="nav-button"
                      isActive={view === next}
                      onClick={() => onChooseView(next)}
                    >
                      <Icon size={21} />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
              <button className="primary full" onClick={onCompose}>
                <Plus size={18} />
                Drop a post
              </button>
              <div className="side-note">
                <span aria-hidden="true">↳</span>
                <p>
                  A social network.
                  <br />
                  With a different perspective.
                </p>
              </div>
              <button className="source-note" onClick={onOpenSource}>
                <Code2 size={19} />
                <span className="source-note-text">
                  <b>Open source. Open minds.</b>
                  <span>Pants firmly on.</span>
                </span>
              </button>
            </SidebarContent>
          </Sidebar>
          <main className="feed-main" id="main-content">
            {children}
            <footer className="app-footer">
              <span>Assbook © 2026 · Fun by design, serious about safety and business.</span>
              <nav aria-label="Footer">
                {legalLinks.map(({ href, label }) => (
                  <Link key={href} href={href}>
                    {label}
                  </Link>
                ))}
                <a href={SOURCE_URL} target="_blank" rel="noreferrer">
                  Open source
                </a>
              </nav>
            </footer>
          </main>
          <aside className="right-rail">
            {rail}
            <section className="rule-card">
              <div className="rule-top">
                <span>THE DRESS CODE</span>
                <span aria-hidden="true">↗</span>
              </div>
              <h2>
                All cheek.
                <br />
                No cheeks.
              </h2>
              <p>
                Your profile photo? Your own behind.{" "}
                <strong>Fully clothed.</strong> Always.
              </p>
              <div>
                <Check size={16} aria-hidden="true" />
                Jeans, shorts, whatever.
              </div>
              <div>
                <Check size={16} aria-hidden="true" />
                Be kind. No body shaming.
              </div>
              <div>
                <Check size={16} aria-hidden="true" />
                Your photo. Your permission.
              </div>
              <button className="text-link" onClick={onOpenRules}>
                Read the house rules
              </button>
            </section>
            <div className="manifesto">
              <Sparkles size={19} aria-hidden="true" />
              <p>
                Less polished.
                <br />
                More personality.
              </p>
            </div>
            <footer>
              Assbook © 2026 · Made for a laugh.
              <br />
              <button onClick={onOpenRules}>Community rules</button> ·{" "}
              <button onClick={onOpenSource}>Open source</button>
            </footer>
          </aside>
        </div>
        {user && onPostPeek && (
          <button
            className="peek-fab"
            aria-label="Post a peek, ten seconds of your day"
            onClick={onPostPeek}
          >
            <Video size={20} aria-hidden="true" />
          </button>
        )}
        <button className="compose-fab" aria-label="Write a post" onClick={onCompose}>
          <Pencil size={21} aria-hidden="true" />
        </button>
        <nav className="mobile-nav" aria-label="Main navigation">
          {mobileNavItems.map(({ icon: Icon, label, view: next, action }) => (
            <button
              key={label}
              aria-label={label}
              aria-current={next && view === next ? "page" : undefined}
              className={next && view === next ? "active" : ""}
              onClick={() => {
                if (action === "search") onFocusSearch();
                else if (action === "about") onOpenSource();
                else if (next) onChooseView(next);
              }}
            >
              <Icon size={22} aria-hidden="true" />
            </button>
          ))}
        </nav>
      </div>
    </SidebarProvider>
  );
}
