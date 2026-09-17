"use client";
import { AccountSecurity, AccountRecovery } from "./account-security";
import { useEffect, useRef, useState } from "react";
import {
  Home,
  Users,
  Bookmark,
  UserRound,
  ArrowUpRight,
  Heart,
  MessageCircle,
  Send,
  ImagePlus,
  Search,
  ArrowRight,
  Code2,
  Sparkles,
  Check,
  Plus,
  MoreHorizontal,
  Flag,
  Ban,
  Trash2,
  LogOut,
  Loader2,
  Camera,
  X,
  RefreshCw,
  Download,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { toast, Toaster } from "sonner";
import type { Profile, Post, Comment } from "@/lib/types";
const nav = [
  { icon: Home, label: "The Bottom Line", view: "everyone" },
  { icon: Users, label: "Following", view: "following" },
  { icon: Bookmark, label: "Saved for later", view: "saved" },
  { icon: UserRound, label: "Your backside", view: "profile" },
];
async function api<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch("/api/" + path, {
    method,
    credentials: "same-origin",
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(result.error ?? "Could not complete that. Try again.");
  return result;
}
function Avatar({
  person,
  large = false,
}: {
  person?: { avatar?: string | null; handle?: string };
  large?: boolean;
}) {
  return (
    <span className={"avatar " + (large ? "large" : "")}>
      {person?.avatar ? (
        <img
          src={person.avatar}
          alt={person.handle + "’s fully clothed profile photo"}
        />
      ) : person?.handle === "jeanclaude" ? (
        "🩳"
      ) : (
        "👖"
      )}
    </span>
  );
}
function age(time: number) {
  if (time < 100) return "Sample post";
  const mins = Math.max(0, Math.floor((Date.now() - time) / 60000));
  return mins < 1
    ? "Just now"
    : mins < 60
      ? mins + "m"
      : mins < 1440
        ? Math.floor(mins / 60) + "h"
        : new Date(time).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });
}
export default function Assbook() {
  const [user, setUser] = useState<Profile | null>(null),
    [posts, setPosts] = useState<Post[]>([]),
    [people, setPeople] = useState<Profile[]>([]);
  const [view, setView] = useState("everyone"),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [profileHandle, setProfileHandle] = useState(""),
    [profile, setProfile] = useState<Profile | null>(null);
  const [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [busy, setBusy] = useState(false),
    [hasMore, setHasMore] = useState(false);
  const [modal, setModal] = useState(""),
    [authMode, setAuthMode] = useState("signup"),
    [formError, setFormError] = useState(""),
    [rules, setRules] = useState(false),
    [draft, setDraft] = useState(""),
    [postImage, setPostImage] = useState<string | null>(null);
  const [editName, setEditName] = useState(""),
    [editBio, setEditBio] = useState(""),
    [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState("post"),
    [file, setFile] = useState<File | null>(null),
    [filePreview, setFilePreview] = useState(""),
    [photoRules, setPhotoRules] = useState(false);
  const [replyPost, setReplyPost] = useState<Post | null>(null),
    [comments, setComments] = useState<Comment[]>([]),
    [reply, setReply] = useState(""),
    [reportPost, setReportPost] = useState<Post | null>(null),
    [blocked, setBlocked] = useState<Profile[]>([]);
  const [reports, setReports] = useState<
    {
      id: string;
      post_id: string;
      reason: string;
      body: string;
      handle: string;
    }[]
  >([]);
  const [recoveryToken, setRecoveryToken] = useState("");
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const refresh = () => setRevision((n) => n + 1);
  const show = (name: string) => {
    setFormError("");
    setModal(name);
  };
  const needUser = () => {
    if (user) return true;
    show("auth");
    return false;
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setFormError("");
    try {
      await action();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setFormError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const readLink = () => {
      const fragment = new URLSearchParams(location.hash.slice(1));
      for (const mode of ["reset", "verify"]) {
        const token = fragment.get(mode);
        if (token) {
          setRecoveryToken(token); setModal(mode); setFormError("");
          history.replaceState(null, "", location.pathname + location.search);
          break;
        }
      }
    };
    readLink();
    window.addEventListener("hashchange", readLink);
    return () => window.removeEventListener("hashchange", readLink);
  }, []);
  useEffect(() => {
    api<{ user: Profile | null }>("me")
      .then((d) => setUser(d.user))
      .catch(() => {});
    const p = new URLSearchParams(location.search).get("profile");
    if (p) {
      setProfileHandle(p);
      setView("profile");
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    let path = "feed?filter=" + view + "&q=" + encodeURIComponent(query);
    if (view === "profile")
      path +=
        "&profile=" +
        encodeURIComponent(profileHandle || user?.handle || "__none__");
    const one = new URLSearchParams(location.search).get("post");
    if (one && view === "everyone" && !query)
      path += "&post=" + encodeURIComponent(one);
    api<{ posts: Post[]; hasMore: boolean }>(path)
      .then((d) => {
        if (active) {
          setPosts(d.posts);
          setHasMore(d.hasMore);
        }
      })
      .catch((e) => {
        if (active) setLoadError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [view, query, revision, user, profileHandle]);
  useEffect(() => {
    let active = true;
    api<{ people: Profile[] }>("people")
      .then((d) => {
        if (active) setPeople(d.people);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [revision, user]);
  useEffect(() => {
    if (view !== "profile") return;
    let active = true;
    const handle = profileHandle || user?.handle;
    if (!handle) {
      setProfile(null);
      return;
    }
    api<{ profile: Profile }>("profile/" + encodeURIComponent(handle))
      .then((d) => {
        if (active) setProfile(d.profile);
      })
      .catch((e) => {
        if (active) {
          setProfile(null);
          setLoadError(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [view, profileHandle, user, revision]);
  useEffect(() => {
    if (!file) {
      setFilePreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    type Tool = {
      name: string;
      description: string;
      inputSchema: object;
      annotations: object;
      execute: (input: unknown) => unknown;
    };
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: Tool,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "stage_assbook_post",
            description:
              "Place text in the visible Assbook composer for the user to review. Does not publish the post.",
            inputSchema: {
              type: "object",
              properties: {
                text: { type: "string", minLength: 1, maxLength: 500 },
              },
              required: ["text"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute(input) {
              if (
                !input ||
                typeof input !== "object" ||
                !("text" in input) ||
                typeof input.text !== "string" ||
                !input.text.trim() ||
                input.text.length > 500
              )
                throw new Error("Provide 1–500 characters of text.");
              setView("everyone");
              setSearch("");
              setDraft(input.text);
              history.replaceState(null, "", "/");
              requestAnimationFrame(() => draftRef.current?.focus());
              return {
                status: "staged",
                characters: input.text.length,
                published: false,
              };
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => console.warn("Assbook agent tools unavailable."));
    } catch {
      console.warn("Assbook agent tools unavailable.");
    }
    return () => controller.abort();
  }, []);
  const chooseView = (next: string) => {
    if (["saved", "profile"].includes(next) && !needUser()) return;
    setView(next);
    setSearch("");
    setProfileHandle("");
    history.replaceState(null, "", "/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const visitProfile = (handle: string) => {
    setView("profile");
    setProfileHandle(handle);
    setSearch("");
    history.replaceState(null, "", "/?profile=" + encodeURIComponent(handle));
    window.scrollTo({ top: 0, behavior: "smooth" });
    setModal("");
  };
  const startPost = () => {
    chooseView("everyone");
    requestAnimationFrame(() => draftRef.current?.focus());
  };
  const follow = (person: Profile) => {
    if (!needUser()) return;
    void run(async () => {
      await api("follow/" + person.id, person.following ? "DELETE" : "PUT");
      refresh();
      toast.success(
        person.following
          ? "You’re going your own way."
          : "You’re right behind " + person.name + ".",
      );
    });
  };
  const post = async () => {
    if (!needUser()) return;
    await run(async () => {
      await api("posts", "POST", { body: draft, image: postImage });
      setDraft("");
      setPostImage(null);
      setView("everyone");
      history.replaceState(null, "", "/");
      refresh();
      toast.success("Your post has landed. 🍑");
    });
  };
  const react = (p: Post, kind: "like" | "save") => {
    if (!needUser()) return;
    void run(async () => {
      const active = kind === "like" ? p.liked : p.saved;
      await api(kind + "/" + p.id, active ? "DELETE" : "PUT");
      refresh();
      if (kind === "save")
        toast.success(
          active ? "Removed from saved posts." : "Saved for later.",
        );
    });
  };
  const openReplies = (p: Post) => {
    setReplyPost(p);
    setComments([]);
    setReply("");
    show("replies");
    void run(async () => {
      const d = await api<{ comments: Comment[] }>("comments/" + p.id);
      setComments(d.comments);
    });
  };
  const share = async (p: Post) => {
    const link = location.origin + "/?post=" + encodeURIComponent(p.id);
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Post link copied.");
    } catch {
      show("share");
      setReply(link);
    }
  };
  const edit = () => {
    if (!user) return;
    setEditName(user.name);
    setEditBio(user.bio);
    setEditAvatar(user.avatar);
    show("edit");
  };
  const openUpload = (target: string) => {
    if (!needUser()) return;
    setUploadTarget(target);
    setFile(null);
    setPhotoRules(false);
    show("upload");
  };
  const listBlocked = () => {
    show("blocked");
    void run(async () => {
      setBlocked((await api<{ people: Profile[] }>("blocks")).people);
    });
  };
  const listReports = () => {
    show("moderation");
    void run(async () => {
      setReports((await api<{ reports: typeof reports }>("admin")).reports);
    });
  };
  const title =
    view === "following"
      ? "Right behind them"
      : view === "saved"
        ? "Saved for later"
        : view === "profile"
          ? (profile?.name ?? "Your backside")
          : "The Bottom Line";
  const peopleList = (all = false) => (
    <>
      {people.slice(0, all ? 20 : 3).map((p) => (
        <div className="person" key={p.id}>
          <button
            onClick={() => visitProfile(p.handle)}
            aria-label={"View " + p.name}
          >
            <Avatar person={p} />
          </button>
          <button
            className="person-name"
            onClick={() => visitProfile(p.handle)}
          >
            <b>{p.name}</b>
            <p>@{p.handle}</p>
          </button>
          <button
            disabled={busy}
            className={"follow-button " + (p.following ? "is-following" : "")}
            onClick={() => follow(p)}
            aria-label={(p.following ? "Unfollow " : "Follow ") + p.name}
          >
            {p.following ? <Check size={16} /> : <Plus size={16} />}
            <span>{p.following ? "Following" : "Follow"}</span>
          </button>
        </div>
      ))}
    </>
  );
  return (
    <SidebarProvider>
      <div className="app-shell">
        <Toaster position="bottom-center" richColors />
        <header className="topbar">
          <a
            className="brand"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              chooseView("everyone");
            }}
          >
            <span className="brandmark">🍑</span>assbook
            <span className="beta">BETA</span>
          </a>
          <div className="searchbox">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setView("everyone");
                history.replaceState(null, "", "/");
              }}
              aria-label="Search Assbook"
              placeholder="Find your people. From behind."
            />
            {search && (
              <button aria-label="Clear search" onClick={() => setSearch("")}>
                <X size={15} />
              </button>
            )}
          </div>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="join-button">
                  <Avatar person={user} />
                  <span>@{user.handle}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => visitProfile(user.handle)}>
                  Your profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={edit}>Edit profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => show("security")}>Account security</DropdownMenuItem>
                <DropdownMenuItem onClick={listBlocked}>
                  Blocked accounts
                </DropdownMenuItem>
                {user.isAdmin && (
                  <DropdownMenuItem onClick={listReports}>
                    Moderation queue
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() =>
                    void run(async () => {
                      await api("logout", "POST");
                      setUser(null);
                      chooseView("everyone");
                      toast.success("See you on the backside.");
                    })
                  }
                >
                  <LogOut size={15} />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button className="join-button" onClick={() => show("auth")}>
              Join the backside <ArrowUpRight size={17} />
            </button>
          )}
        </header>
        <div className="three-columns">
          <Sidebar collapsible="none" className="leftnav">
            <SidebarContent>
              <div className="nav-label">YOUR LITTLE CORNER</div>
              <SidebarMenu>
                {nav.map(({ icon: Icon, label, view: next }) => (
                  <SidebarMenuItem key={label}>
                    <SidebarMenuButton
                      className="nav-button"
                      isActive={view === next}
                      onClick={() => chooseView(next)}
                    >
                      <Icon size={21} />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
              <button className="primary full" onClick={startPost}>
                <Plus size={18} />
                Drop a post
              </button>
              <div className="side-note">
                <span>↳</span>
                <p>
                  A social network.
                  <br />
                  With a different perspective.
                </p>
              </div>
              <button className="source-note" onClick={() => show("source")}>
                <Code2 size={19} />
                <div>
                  <b>Open source. Open minds.</b>
                  <p>Pants firmly on.</p>
                </div>
              </button>
            </SidebarContent>
          </Sidebar>
          <main className="feed-main">
            <section className="intro">
              <div>
                <div className="eyebrow">THE INTERNET’S OTHER SIDE</div>
                <h1>
                  {title}
                  <span>.</span>
                </h1>
                <p>
                  {view === "everyone"
                    ? "Good people. Bad puns. Great jeans."
                    : view === "following"
                      ? "A little closer to your favorite people."
                      : view === "saved"
                        ? "The posts you want to come back to."
                        : "A little personality. A different perspective."}
                </p>
              </div>
              <span className="intro-stamp">
                100%<small>cheeky</small>
              </span>
            </section>
            <div className="mobile-search">
              <Search size={17} />
              <input
                value={search}
                aria-label="Search posts"
                onChange={(e) => {
                  setSearch(e.target.value);
                  setView("everyone");
                }}
                placeholder="Search the backside…"
              />
            </div>
            {view === "profile" && profile && (
              <section className="profile-card card">
                <Avatar person={profile} large />
                <div>
                  <h2>{profile.name}</h2>
                  <p className="muted">
                    @{profile.handle}
                    {profile.demo ? " · Sample profile" : ""}
                  </p>
                  <p>{profile.bio || "Still finding the right words."}</p>
                  <p className="small">{profile.followers ?? 0} followers</p>
                </div>
                {user?.id === profile.id ? (
                  <button className="follow-button" onClick={edit}>
                    Edit profile
                  </button>
                ) : (
                  <button
                    className="follow-button"
                    disabled={busy}
                    onClick={() => follow(profile)}
                  >
                    {profile.following ? "Following" : "Follow"}
                  </button>
                )}
              </section>
            )}
            {view === "everyone" && !query && (
              <section className="composer card">
                <div className="compose-top">
                  <Avatar person={user ?? undefined} />
                  <textarea
                    ref={draftRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={500}
                    aria-label="Write a post"
                    placeholder="What’s happening behind the scenes?"
                  />
                </div>
                {postImage && (
                  <div className="attachment">
                    <img src={postImage} alt="Your attached photo" />
                    <button
                      className="icon-button"
                      aria-label="Remove attached photo"
                      onClick={() => setPostImage(null)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                <div className="compose-bottom">
                  <button className="quiet" onClick={() => openUpload("post")}>
                    <ImagePlus size={18} />
                    Photo
                  </button>
                  <span>
                    {draft.length
                      ? draft.length + "/500"
                      : "Keep it cheeky. Keep it clothed."}
                  </span>
                  <button
                    className="primary"
                    disabled={busy || (!draft.trim() && !postImage)}
                    onClick={() => void post()}
                  >
                    Post <ArrowRight size={16} />
                  </button>
                </div>
              </section>
            )}
            <div className="feed-toolbar">
              <Tabs value={view} onValueChange={chooseView}>
                <TabsList variant="line">
                  <TabsTrigger value="everyone">Everyone</TabsTrigger>
                  <TabsTrigger value="following">Following</TabsTrigger>
                </TabsList>
              </Tabs>
              <span>{query ? "SEARCH RESULTS" : "THE LATEST ↓"}</span>
            </div>
            {posts.some((p) => p.demo) && (
              <div className="sample-label">
                Sample profiles are labeled. Be the first real one.
              </div>
            )}
            {loading ? (
              <div className="state-card" role="status">
                <Loader2 className="spin" size={22} />
                Getting the bottom of things…
              </div>
            ) : loadError ? (
              <div className="state-card" role="alert">
                <p>{loadError}</p>
                <button className="quiet" onClick={refresh}>
                  <RefreshCw size={16} />
                  Try again
                </button>
              </div>
            ) : posts.length === 0 ? (
              <div className="state-card empty-card">
                <span>🍑</span>
                <h2>
                  {query
                    ? "Nobody back here."
                    : view === "saved"
                      ? "A little empty back here."
                      : view === "following"
                        ? "Find your kind of people."
                        : "You’re early. We like that."}
                </h2>
                <p>
                  {query
                    ? "Try another name, handle, or phrase."
                    : view === "saved"
                      ? "Tap the bookmark on a post to save it here."
                      : view === "following"
                        ? "Follow a few people to bring their posts here."
                        : "Drop the first post. Someone has to go first."}
                </p>
                <button
                  className="primary"
                  onClick={
                    view === "following" ? () => show("people") : startPost
                  }
                >
                  {view === "following"
                    ? "Meet the community"
                    : "The Bottom Line"}
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              posts.map((p) => (
                <article className="post card" key={p.id} id={"post-" + p.id}>
                  <div className="post-head">
                    <button
                      onClick={() => visitProfile(p.handle)}
                      aria-label={"View " + p.name}
                    >
                      <Avatar person={p} />
                    </button>
                    <button
                      className="person-name"
                      onClick={() => visitProfile(p.handle)}
                    >
                      <b>
                        {p.name}
                        {p.demo === 1 && (
                          <span className="tiny-badge">SAMPLE</span>
                        )}
                      </b>
                      <p>
                        @{p.handle} · {age(p.created)}
                      </p>
                    </button>
                    <button
                      disabled={busy}
                      className={"icon-button " + (p.saved ? "selected" : "")}
                      onClick={() => react(p, "save")}
                      aria-label={
                        (p.saved ? "Unsave" : "Save") + " post by " + p.name
                      }
                      aria-pressed={!!p.saved}
                    >
                      <Bookmark
                        size={19}
                        fill={p.saved ? "currentColor" : "none"}
                      />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="icon-button menu-trigger"
                          aria-label={"More options for post by " + p.name}
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {user?.id === p.user_id ? (
                          <DropdownMenuItem
                            onClick={() =>
                              void run(async () => {
                                await api("posts/" + p.id, "DELETE");
                                refresh();
                                toast.success("Post removed.");
                              })
                            }
                          >
                            <Trash2 size={15} />
                            Remove your post
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem
                              onClick={() => {
                                if (needUser()) {
                                  setReportPost(p);
                                  show("report");
                                }
                              }}
                            >
                              <Flag size={15} />
                              Report post
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if (needUser())
                                  void run(async () => {
                                    await api("block/" + p.user_id, "PUT");
                                    refresh();
                                    toast.success(
                                      "You’ve left them behind. Manage blocks in your account menu.",
                                    );
                                  });
                              }}
                            >
                              <Ban size={15} />
                              Leave them behind (block)
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="post-text">{p.body}</p>
                  {p.image && (
                    <img
                      className="post-photo"
                      src={p.image}
                      alt={
                        p.demo
                          ? "Three fully clothed friends in jeans against a blue wall"
                          : "Photo shared by " + p.name
                      }
                      loading="lazy"
                    />
                  )}
                  <div className="post-actions">
                    <button
                      disabled={busy}
                      className={p.liked ? "selected" : ""}
                      aria-pressed={!!p.liked}
                      onClick={() => react(p, "like")}
                    >
                      <Heart
                        size={19}
                        fill={p.liked ? "currentColor" : "none"}
                      />
                      {p.likes || "Like"}
                    </button>
                    <button onClick={() => openReplies(p)}>
                      <MessageCircle size={19} />
                      {p.comments || "Reply"}
                    </button>
                    <button onClick={() => void share(p)}>
                      <Send size={18} />
                      Share
                    </button>
                    <span>
                      {p.demo
                        ? "Just a little inspiration."
                        : "Pants on. Personality out."}
                    </span>
                  </div>
                </article>
              ))
            )}
            {!loading && hasMore && (
              <button
                className="load-more"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const d = await api<{ posts: Post[]; hasMore: boolean }>(
                      "feed?filter=" +
                        view +
                        "&q=" +
                        encodeURIComponent(query) +
                        "&profile=" +
                        encodeURIComponent(
                          view === "profile"
                            ? profileHandle || user?.handle || ""
                            : "",
                        ) +
                        "&offset=" +
                        posts.length,
                    );
                    setPosts((old) => [...old, ...d.posts]);
                    setHasMore(d.hasMore);
                  })
                }
              >
                A little further down <ArrowRight size={16} />
              </button>
            )}
          </main>
          <aside className="right-rail">
            <section className="people card">
              <div className="eyebrow">SMALL WORLD. GREAT JEANS.</div>
              <h2>
                People you’ve
                <br />
                fallen behind.
              </h2>
              {peopleList()}
              <button className="text-link" onClick={() => show("people")}>
                Meet the community <ArrowUpRight size={14} />
              </button>
            </section>
            <section className="rule-card">
              <div className="rule-top">
                <span>THE DRESS CODE</span>
                <span>↗</span>
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
                <Check size={16} />
                Jeans, shorts, whatever.
              </div>
              <div>
                <Check size={16} />
                Be kind. No body shaming.
              </div>
              <div>
                <Check size={16} />
                Your photo. Your permission.
              </div>
              <button className="text-link" onClick={() => show("rules")}>
                Read the house rules
              </button>
            </section>
            <div className="manifesto">
              <Sparkles size={19} />
              <p>
                Less polished.
                <br />
                More personality.
              </p>
            </div>
            <footer>
              Assbook © 2026 · Made for a laugh.
              <br />
              <button onClick={() => show("rules")}>
                Community rules
              </button> ·{" "}
              <button onClick={() => show("source")}>Open source</button>
            </footer>
          </aside>
        </div>
        <nav className="mobile-nav" aria-label="Main navigation">
          {nav.map(({ icon: Icon, label, view: next }) => (
            <button
              key={next}
              aria-label={label}
              className={view === next ? "active" : ""}
              onClick={() => chooseView(next)}
            >
              <Icon size={22} />
            </button>
          ))}
          <button aria-label="About Assbook" onClick={() => show("source")}>
            <Code2 size={22} />
          </button>
        </nav>
        <Dialog
          open={!!modal}
          onOpenChange={(open) => {
            if (!open && !busy) setModal("");
          }}
        >
          <DialogContent className="assbook-dialog">
            <DialogHeader>
              <DialogTitle>
                {
                  (
                    {
                      auth:
                        authMode === "signup"
                          ? "Welcome to the backside."
                          : "Look who’s back.",
                      security: "Keep your account yours.",
                      recover: "Let’s get you back in.",
                      reset: "Choose a new password.",
                      verify: "Verify your recovery email.",
                      edit: "Your best side.",
                      upload: "Pants on. Camera ready.",
                      replies: "Behind the scenes.",
                      report: "Help keep it friendly.",
                      rules: "The house rules.",
                      source: "Open source. Pants on.",
                      people: "People you’ve fallen behind.",
                      blocked: "People you’ve left behind.",
                      moderation: "Community reports.",
                      share: "Pass it around.",
                    } as Record<string, string>
                  )[modal]
                }
              </DialogTitle>
              <DialogDescription>
                {
                  (
                    {
                      auth: "Good people. Bad puns. You’ll fit right in.",
                      security: "Recovery email, password, and signed-in sessions.",
                      recover: "We’ll email a link if your address is verified on an account.",
                      reset: "A fresh password for your backside.",
                      verify: "One last step to enable account recovery.",
                      edit: "A little personality goes a long way.",
                      upload: "Only your own photos. Fully clothed, always.",
                      replies: "Add something kind. Or a truly terrible pun.",
                      report: "A moderator can review your report.",
                      rules: "A silly idea. A few sensible boundaries.",
                      source:
                        "A ridiculous idea, built for anyone to make their own.",
                      people: "Find someone worth falling behind.",
                      blocked: "You can change your mind any time.",
                      moderation: "Review the reported posts below.",
                      share: "Copy this link to share the post.",
                    } as Record<string, string>
                  )[modal]
                }
              </DialogDescription>
            </DialogHeader>
            {formError && (
              <div className="form-error" role="alert">
                {formError}
              </div>
            )}
            {modal === "auth" && (
              <form
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  void run(async () => {
                    const result = await api<{ verificationSent?: boolean }>(authMode, "POST", {
                      email: data.get("email"),
                      name: data.get("name"),
                      handle: data.get("handle"),
                      password: data.get("password"),
                      rules,
                    });
                    const d = await api<{ user: Profile }>("me");
                    setUser(d.user);
                    setModal(authMode === "signup" ? "security" : "");
                    if (authMode === "signup" && !result.verificationSent) toast.error("Your account is created, but email could not be sent. Retry from Account security.");
                    refresh();
                    toast.success(
                      authMode === "signup"
                        ? "Welcome to the backside! 🍑"
                        : "Good to have you back.",
                    );
                  });
                }}
              >
                {authMode === "signup" && (
                  <label>
                    Your name
                    <input
                      name="name"
                      required
                      maxLength={40}
                      autoComplete="name"
                      placeholder="Jean Claude"
                    />
                  </label>
                )}
                {authMode === "signup" && <label>Your email<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" /></label>}
                <label>
                  Your handle
                  <input
                    name="handle"
                    required
                    minLength={3}
                    maxLength={24}
                    pattern="[a-zA-Z0-9_]{3,24}"
                    autoComplete="username"
                    placeholder="jeanclaude"
                  />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={authMode === "signup" ? 15 : 1}
                    maxLength={128}
                    autoComplete={
                      authMode === "signup"
                        ? "new-password"
                        : "current-password"
                    }
                    placeholder={authMode === "signup" ? "At least 15 characters" : "Your password"}
                  />
                </label>
                {authMode === "signup" && (
                  <>
                    <label className="checkbox-line">
                      <Checkbox
                        checked={rules}
                        onCheckedChange={(v) => setRules(v === true)}
                        aria-label="Agree to community rules"
                      />
                      <span>
                        I’ll keep photos my own and fully clothed, and treat
                        people kindly.
                      </span>
                    </label>
                    <p className="small muted">
                      We’ll send a verification link to enable account recovery. Your email is never shown on your profile.
                    </p>
                  </>
                )}
                <button
                  className="primary"
                  disabled={busy || (authMode === "signup" && !rules)}
                >
                  {busy ? <Loader2 className="spin" size={17} /> : null}
                  {authMode === "signup" ? "Join the backside" : "Sign in"}
                  <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  className="text-link centered"
                  onClick={() => {
                    setAuthMode(authMode === "signup" ? "login" : "signup");
                    setFormError("");
                  }}
                >
                  {authMode === "signup"
                    ? "Already here? Sign in."
                    : "New here? Grab a handle."}
                </button>
                {authMode === "login" && <button type="button" className="text-link centered" onClick={() => show("recover")}>Forgot your password?</button>}
                <button
                  className="small muted"
                  type="button"
                  onClick={() => show("rules")}
                >
                  Read the community rules
                </button>
              </form>
            )}
            {modal === "security" && user && <AccountSecurity signedOut={() => {
              setUser(null); setAuthMode("login"); show("auth"); refresh(); toast.success("Password changed. Please sign in again.");
            }} />}
            {["recover", "reset", "verify"].includes(modal) && <AccountRecovery key={modal} mode={modal} token={recoveryToken}
              recover={() => {setRecoveryToken(""); show("recover");}}
              done={(message) => {setRecoveryToken(""); setUser(null); setAuthMode("login"); show("auth"); refresh(); toast.success(message);}} />}
            {modal === "edit" && (
              <form
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await api("profile", "PUT", {
                      name: editName,
                      bio: editBio,
                      avatar: editAvatar,
                    });
                    setUser((await api<{ user: Profile }>("me")).user);
                    setModal("");
                    refresh();
                    toast.success("Your best side, updated.");
                  });
                }}
              >
                <div className="avatar-editor">
                  <Avatar
                    person={{ avatar: editAvatar, handle: user?.handle }}
                    large
                  />
                  <button
                    type="button"
                    className="follow-button"
                    onClick={() => openUpload("avatar")}
                  >
                    <Camera size={16} />
                    Change photo
                  </button>
                  {editAvatar && (
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => setEditAvatar(null)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <label>
                  Name
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    maxLength={40}
                  />
                </label>
                <label>
                  Bio
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    maxLength={160}
                    placeholder="Tell us a little about the person in the pants."
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Save profile <Check size={17} />
                </button>
              </form>
            )}
            {modal === "upload" && (
              <div className="form-stack">
                <label className="upload-box">
                  <ImagePlus size={30} />
                  <b>Choose your photo</b>
                  <span>JPEG, PNG, or WebP · up to 2 MB</span>
                  <input
                    type="file"
                    aria-label="Choose photo"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && f.size > 2 * 1024 * 1024) {
                        setFormError("Please choose a photo under 2 MB.");
                        return;
                      }
                      setFormError("");
                      setFile(f ?? null);
                    }}
                  />
                </label>
                {filePreview && (
                  <img
                    className="upload-preview"
                    src={filePreview}
                    alt="Your selected photo preview"
                  />
                )}
                <label className="checkbox-line">
                  <Checkbox
                    checked={photoRules}
                    onCheckedChange={(v) => setPhotoRules(v === true)}
                    aria-label="Confirm photo ownership and clothing"
                  />
                  <span>
                    {uploadTarget === "avatar"
                      ? "This is my own behind, fully clothed."
                      : "This is my photo, everyone is fully clothed, and I have permission to share it."}
                  </span>
                </label>
                <button
                  disabled={!file || !photoRules || busy}
                  className="primary"
                  onClick={() =>
                    void run(async () => {
                      const response = await fetch("/api/upload", {
                        method: "POST",
                        headers: {
                          "Content-Type": file!.type,
                          "X-Photo-Rules": "accepted",
                        },
                        body: file,
                      });
                      const d = (await response.json()) as {
                        url: string;
                        error?: string;
                      };
                      if (!response.ok) throw new Error(d.error);
                      if (uploadTarget === "avatar") {
                        setEditAvatar(d.url);
                        show("edit");
                      } else {
                        setPostImage(d.url);
                        setModal("");
                      }
                      setFile(null);
                      toast.success("Photo added.");
                    })
                  }
                >
                  {busy ? "Uploading…" : "Use this photo"}
                  <ArrowRight size={17} />
                </button>
              </div>
            )}
            {modal === "replies" && replyPost && (
              <div>
                <p className="reply-original">{replyPost.body}</p>
                <div className="comment-list">
                  {comments.map((c) => (
                    <div className="comment" key={c.id}>
                      <Avatar person={c} />
                      <div>
                        <b>{c.name}</b>
                        <p>{c.body}</p>
                      </div>
                    </div>
                  ))}
                  {!comments.length && !busy && (
                    <p className="muted small">
                      Be the first to get behind this.
                    </p>
                  )}
                </div>
                <form
                  className="reply-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!needUser()) return;
                    void run(async () => {
                      await api("comments/" + replyPost.id, "POST", {
                        body: reply,
                      });
                      setReply("");
                      setComments(
                        (
                          await api<{ comments: Comment[] }>(
                            "comments/" + replyPost.id,
                          )
                        ).comments,
                      );
                      refresh();
                    });
                  }}
                >
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    aria-label="Your reply"
                    maxLength={280}
                    placeholder="A kind word. A bad pun."
                    required
                  />
                  <button
                    className="primary"
                    disabled={busy || !reply.trim()}
                    aria-label="Send reply"
                  >
                    <Send size={17} />
                  </button>
                </form>
              </div>
            )}
            {modal === "report" && (
              <form
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const reason = new FormData(e.currentTarget).get("reason");
                  void run(async () => {
                    await api("report/" + reportPost?.id, "POST", { reason });
                    setModal("");
                    toast.success(
                      "Report saved for moderator review. Thank you.",
                    );
                  });
                }}
              >
                <label>
                  What’s wrong?
                  <textarea
                    name="reason"
                    required
                    maxLength={250}
                    placeholder="Tell us what we should review."
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Send report <Flag size={16} />
                </button>
              </form>
            )}
            {modal === "rules" && (
              <div className="rules-copy">
                <p>
                  <b>1. Pants on. Always.</b>
                  <br />
                  Profile photos show your own fully clothed behind. No nudity
                  or sexual content.
                </p>
                <p>
                  <b>2. Your photo. Your permission.</b>
                  <br />
                  Share only photos you own and have permission to post. No
                  secretly photographed strangers.
                </p>
                <p>
                  <b>3. Be a good human.</b>
                  <br />
                  No harassment, body shaming, hate, or spam. The joke is the
                  website, never somebody’s body.
                </p>
                <p>
                  <b>4. See something off?</b>
                  <br />
                  Report a post from its menu, or block an account to leave it
                  behind.
                </p>
                <p className="small muted">
                  Uploaded photos are not automatically verified. This beta
                  relies on community reports and moderator review.
                </p>
              </div>
            )}
            {modal === "source" && (
              <div className="rules-copy">
                <div className="source-hero">
                  🍑 <Code2 size={32} />
                </div>
                <p>
                  <b>The internet could use a little less seriousness.</b>
                </p>
                <p>
                  Assbook is an open-source social network with one ridiculous
                  rule: your profile photo is your own fully clothed behind.
                </p>
                <p>
                  MIT-licensed. Free to use, modify, and self-host. Bring your
                  own puns.
                </p>
                <a className="primary" href="/assbook-source.zip" download>
                  <Download size={17} />
                  Download the source
                </a>
                <p className="small muted">
                  Includes the app, Cloudflare setup guide, and contribution
                  guidelines.
                </p>
                <button className="text-link" onClick={() => show("rules")}>
                  Community rules <ArrowUpRight size={14} />
                </button>
              </div>
            )}
            {modal === "people" && (
              <div>
                {peopleList(true)}
                {!people.length && (
                  <p className="muted">
                    You’re the first one here. Invite a friend.
                  </p>
                )}
              </div>
            )}
            {modal === "blocked" && (
              <div>
                {blocked.map((p) => (
                  <div className="person" key={p.id}>
                    <Avatar person={p} />
                    <div>
                      <b>{p.name}</b>
                      <p>@{p.handle}</p>
                    </div>
                    <button
                      className="follow-button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await api("block/" + p.id, "DELETE");
                          setBlocked((old) => old.filter((x) => x.id !== p.id));
                          refresh();
                          toast.success("Account unblocked.");
                        })
                      }
                    >
                      Unblock
                    </button>
                  </div>
                ))}
                {!blocked.length && (
                  <p className="muted">Nobody left behind. Nice.</p>
                )}
              </div>
            )}
            {modal === "moderation" && (
              <div>
                {reports.map((r) => (
                  <div className="report-item" key={r.id}>
                    <b>@{r.handle}</b>
                    <p>{r.body}</p>
                    <p className="small">Report: {r.reason}</p>
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await api("admin/" + r.post_id, "DELETE");
                          setReports((old) =>
                            old.filter((x) => x.post_id !== r.post_id),
                          );
                          refresh();
                        })
                      }
                    >
                      Hide post
                    </button>
                  </div>
                ))}
                {!reports.length && (
                  <p className="muted">No reports to review.</p>
                )}
              </div>
            )}
            {modal === "share" && (
              <input
                className="share-input"
                aria-label="Post link"
                readOnly
                value={reply}
                onFocus={(e) => e.target.select()}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SidebarProvider>
  );
}
