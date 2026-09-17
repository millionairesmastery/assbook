"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { Toaster } from "sonner";
import {
  ArrowUpRight,
  Check,
  Code2,
  LogOut,
  Pencil,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
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
import { navItems } from "@/components/assbook/nav-items";
import type { Profile } from "@/lib/types";

export type AppShellProps = {
  user: Profile | null;
  view: string;
  search: string;
  onSearch: (next: string) => void;
  onChooseView: (view: string) => void;
  onVisitProfile: (handle: string) => void;
  onEditProfile: () => void;
  onOpenSecurity: () => void;
  onOpenBlocked: () => void;
  onOpenModeration: () => void;
  onSignOut: () => void;
  onJoin: () => void;
  onOpenRules: () => void;
  onOpenSource: () => void;
  onCompose: () => void;
  onFocusSearch: () => void;
  rail: ReactNode;
  children: ReactNode;
};

export function AppShell({
  user,
  view,
  search,
  onSearch,
  onChooseView,
  onVisitProfile,
  onEditProfile,
  onOpenSecurity,
  onOpenBlocked,
  onOpenModeration,
  onSignOut,
  onJoin,
  onOpenRules,
  onOpenSource,
  onCompose,
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
              onChooseView("everyone");
            }}
          >
            <span className="brandmark" aria-hidden="true">
              🍑
            </span>
            assbook
            <span className="beta">BETA</span>
          </Link>
          <SearchField value={search} onChange={onSearch} variant="topbar" />
          {user ? (
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
          ) : (
            <button className="join-button" onClick={onJoin}>
              Join the backside <ArrowUpRight size={17} />
            </button>
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
        <button className="compose-fab" aria-label="Write a post" onClick={onCompose}>
          <Pencil size={21} aria-hidden="true" />
        </button>
        <nav className="mobile-nav" aria-label="Main navigation">
          {navItems.map(({ icon: Icon, label, view: next }) => (
            <button
              key={next}
              aria-label={label}
              aria-current={view === next ? "page" : undefined}
              className={view === next ? "active" : ""}
              onClick={() => onChooseView(next)}
            >
              <Icon size={22} aria-hidden="true" />
            </button>
          ))}
          <button aria-label="Search Assbook" onClick={onFocusSearch}>
            <Search size={22} aria-hidden="true" />
          </button>
          <button aria-label="About Assbook" onClick={onOpenSource}>
            <Code2 size={22} aria-hidden="true" />
          </button>
        </nav>
      </div>
    </SidebarProvider>
  );
}
