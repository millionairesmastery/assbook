"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/assbook/app-shell";
import { LandingPage } from "@/components/assbook/landing/landing-page";
import { SearchField } from "@/components/assbook/search-field";
import { useAgentTools } from "@/components/assbook/agent-tools";
import { Feed } from "@/components/assbook/feed/feed";
import { Composer } from "@/components/assbook/composer/composer";
import { PhotoUploadDialog } from "@/components/assbook/composer/photo-upload-dialog";
import { ProfileCard } from "@/components/assbook/profile/profile-card";
import { EditProfileDialog } from "@/components/assbook/profile/edit-profile-dialog";
import { PeopleRail } from "@/components/assbook/people/people-rail";
import { PeopleView } from "@/components/assbook/people/people-view";
import {
  FollowListDialog,
  type FollowListMode,
} from "@/components/assbook/people/follow-list-dialog";
import { BlockedDialog } from "@/components/assbook/people/blocked-dialog";
import { TopPostsCard } from "@/components/assbook/feed/top-posts-card";
import { AuthDialog } from "@/components/assbook/auth/auth-dialog";
import { AccountSecurityDialog } from "@/components/assbook/auth/account-security-dialog";
import { AccountRecoveryDialog } from "@/components/assbook/auth/account-recovery-dialog";
import { WelcomeDialog } from "@/components/assbook/auth/welcome-dialog";
import { FollowOnboardingDialog } from "@/components/assbook/auth/follow-onboarding-dialog";
import {
  EmailConfirmedDialog,
  type EmailConfirmation,
} from "@/components/assbook/auth/email-confirmed-dialog";
import { ReportDialog } from "@/components/assbook/moderation/report-dialog";
import { ModerationQueueDialog } from "@/components/assbook/moderation/moderation-queue-dialog";
import { RepliesDialog } from "@/components/assbook/replies/replies-dialog";
import {
  RulesDialog,
  ShareDialog,
  SourceDialog,
} from "@/components/assbook/dialogs/static-dialogs";
import {
  privateViews,
  viewBlurb,
  viewHeading,
  viewKicker,
  type FeedTab,
  type ProfileTab,
} from "@/components/assbook/nav-items";
import { useAsyncAction } from "@/hooks/use-async-action";
import { useFeed } from "@/hooks/use-feed";
import { useNow } from "@/hooks/use-now";
import { usePeople } from "@/hooks/use-people";
import { usePersonSearch } from "@/hooks/use-person-search";
import { useProfile } from "@/hooks/use-profile";
import { useTopPosts } from "@/hooks/use-top";
import { useViewer } from "@/hooks/use-viewer";
import { api, errorMessage } from "@/lib/api-client";
import type { Post, Profile } from "@/lib/types";

const RECOVERY_MODES = ["recover", "reset"];
const FEED_TAB_KEY = "assbook:feed-tab";

// The chosen feed tab outlives the tab it was chosen in. Storage can be turned
// off or full, and neither is worth an error on screen.
function storedTab(): FeedTab | null {
  try {
    return localStorage.getItem(FEED_TAB_KEY) === "following"
      ? "following"
      : null;
  } catch {
    return null;
  }
}

function storeTab(tab: FeedTab) {
  try {
    localStorage.setItem(FEED_TAB_KEY, tab);
  } catch {
    // Nothing to do: the tab simply will not be remembered.
  }
}

export default function Assbook({
  knownVisitor = false,
}: {
  // Set by the server when the request carried no session cookie and no deep
  // link, so the landing page is part of the first HTML.
  knownVisitor?: boolean;
}) {
  const viewer = useViewer(knownVisitor);
  const user = viewer.user;
  const viewerId = user?.id ?? "";
  const now = useNow();
  const action = useAsyncAction();

  // Where you are standing: the feed, the community or a profile. The tabs
  // inside the feed and the profile have their own state, so switching a tab
  // never moves the highlight in the sidebar.
  const [view, setView] = useState("feed");
  const [feedTab, setFeedTab] = useState<FeedTab>("everyone");
  const [profileTab, setProfileTab] = useState<ProfileTab>("posts");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [profileHandle, setProfileHandle] = useState("");
  const [postId, setPostId] = useState("");
  // Null until the address bar has been read. A shared ?post= or ?profile=
  // link opens the app itself, signed in or not, so the content is there.
  const [deepLink, setDeepLink] = useState<boolean | null>(knownVisitor ? false : null);

  const [modal, setModal] = useState("");
  const [infoModal, setInfoModal] = useState("");
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [securityNotice, setSecurityNotice] = useState("");
  const [recoveryToken, setRecoveryToken] = useState("");
  const [welcomeEmail, setWelcomeEmail] = useState("");
  const [confirmation, setConfirmation] = useState<EmailConfirmation | null>(
    null,
  );
  const [followList, setFollowList] = useState<FollowListMode | "">("");
  // The follow nudge is offered once per page load. Skipping it leaves it
  // undone on the server, so it comes back on the next visit, not this one.
  const [onboardingClosed, setOnboardingClosed] = useState(false);
  const [replyPost, setReplyPost] = useState<Post | null>(null);
  const [reportPost, setReportPost] = useState<Post | null>(null);
  const [shareLink, setShareLink] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

  const [draft, setDraft] = useState("");
  const [postImage, setPostImage] = useState<string | null>(null);

  const draftRef = useRef<HTMLTextAreaElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  const ownHandle = user?.handle ?? "";
  const profileTarget = view === "profile" ? profileHandle || ownHandle : "";
  const singlePostId = view === "feed" && !query ? postId : "";
  const ownProfile =
    view === "profile" && (!profileHandle || profileHandle === ownHandle);
  // Saved posts live on your own profile, under a tab of their own.
  const savedTab = ownProfile && !!user && profileTab === "saved";

  const followingFeed = view === "feed" && feedTab === "following" && !query;

  // Which slice of posts the server should send. A search or a single post is
  // always asked of everybody, whichever feed tab happens to be open.
  const feedFilter =
    view === "profile"
      ? savedTab
        ? "saved"
        : "profile"
      : query || singlePostId
        ? "everyone"
        : feedTab;

  // A visitor with no account and no shared link gets the landing page, and
  // the app behind it never loads: no feed, no people, no top posts.
  const landing = viewer.ready && !user && deepLink === false;
  const appReady = viewer.ready && !landing;

  const feed = useFeed({
    filter: feedFilter,
    query,
    profileTarget:
      view === "profile" && !savedTab ? profileTarget || "__none__" : "",
    singlePostId,
    viewerId,
    ready: appReady,
  });
  const peopleSearch = usePersonSearch(search);
  const people = usePeople(viewerId, appReady);
  const topPosts = useTopPosts(viewerId, appReady);
  const profileView = useProfile(profileTarget, viewerId, appReady);

  // Stable handles, so the memoised post cards are not thrown away every time
  // a single post in the list changes.
  const { run, pending } = action;
  const {
    patchPost,
    removePost,
    revalidate: revalidateFeed,
    retry: retryFeed,
    loadMore,
  } = feed;
  const { patchFollowing: patchPersonFollowing, revalidate: revalidatePeople } =
    people;
  // Asks /api/me again. Used after onboarding, so `onboarded` stops being false.
  const { retry: refreshViewer } = viewer;
  const {
    patchFollowing: patchProfileFollowing,
    bumpFollowingCount,
  } = profileView;

  // The address bar is the external system here: ?profile= and ?post= deep
  // links on arrival, plus recovery and verification tokens in the fragment.
  useEffect(() => {
    const readFragment = () => {
      const fragment = new URLSearchParams(location.hash.slice(1));
      for (const mode of ["reset", "verify"]) {
        const token = fragment.get(mode);
        if (!token) continue;
        history.replaceState(null, "", location.pathname + location.search);
        if (mode === "verify") {
          // Opening the link is the whole job. The token travels in a
          // same-origin POST; the member only sees the outcome.
          setConfirmation({ status: "working" });
          api<{ signedIn: boolean }>("auth/verify-email", {
            method: "POST",
            body: { token },
          })
            .then((result) =>
              setConfirmation({ status: "ok", signedIn: result.signedIn }),
            )
            .catch((cause: unknown) =>
              setConfirmation({ status: "error", message: errorMessage(cause) }),
            );
        } else {
          setRecoveryToken(token);
          setModal(mode);
        }
        break;
      }
    };
    // The tab you left the feed on, read after mount: the server has no
    // localStorage, and guessing during render would not survive hydration.
    const readStoredTab = () => {
      const stored = storedTab();
      if (stored) setFeedTab(stored);
    };
    const readSearch = () => {
      const params = new URLSearchParams(location.search);
      const handle = params.get("profile");
      const single = params.get("post");
      const auth = params.get("auth");
      if (handle) {
        setProfileHandle(handle);
        setView("profile");
      } else if (single) {
        setPostId(single);
      }
      setDeepLink(!!(handle || single));
      // The legal pages send people back here with ?auth=login or
      // ?auth=signup. The dialog opens, and the parameter is spent: it has no
      // business in a link somebody copies afterwards.
      if (auth === "login" || auth === "signup") {
        setAuthMode(auth);
        setModal("auth");
        params.delete("auth");
        const rest = params.toString();
        history.replaceState(
          null,
          "",
          location.pathname + (rest ? "?" + rest : ""),
        );
      }
    };
    readStoredTab();
    readSearch();
    readFragment();
    window.addEventListener("hashchange", readFragment);
    return () => window.removeEventListener("hashchange", readFragment);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // The tab only changes which posts the feed asks for. The view, and with it
  // the highlight in the sidebar, stays on The Bottom Line.
  const chooseFeedTab = useCallback(
    (next: string) => {
      const tab: FeedTab = next === "following" ? "following" : "everyone";
      setFeedTab(tab);
      storeTab(tab);
      setSearch("");
      setQuery("");
      if (postId || query) history.replaceState(null, "", "/");
      setPostId("");
    },
    [postId, query],
  );

  const requireUser = useCallback(() => {
    if (user) return true;
    setAuthMode("signup");
    setModal("auth");
    return false;
  }, [user]);

  const chooseView = useCallback(
    (next: string) => {
      if (privateViews.includes(next) && !requireUser()) return;
      setView(next);
      setSearch("");
      setQuery("");
      setProfileHandle("");
      setPostId("");
      setProfileTab("posts");
      setFollowList("");
      history.replaceState(null, "", "/");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [requireUser],
  );

  const visitProfile = useCallback((handle: string) => {
    setView("profile");
    setProfileHandle(handle);
    setProfileTab("posts");
    setSearch("");
    setQuery("");
    setPostId("");
    history.replaceState(null, "", "/?profile=" + encodeURIComponent(handle));
    window.scrollTo({ top: 0, behavior: "smooth" });
    setFollowList("");
    setModal("");
  }, []);

  const onSearch = useCallback((next: string) => {
    setSearch(next);
    setView("feed");
    setProfileHandle("");
    setPostId("");
    setProfileTab("posts");
    history.replaceState(null, "", "/");
  }, []);

  const openPost = useCallback((id: string) => {
    setView("feed");
    setSearch("");
    setQuery("");
    setProfileHandle("");
    setPostId(id);
    history.replaceState(null, "", "/?post=" + encodeURIComponent(id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const exitSinglePost = useCallback(() => {
    setPostId("");
    history.replaceState(null, "", "/");
  }, []);

  const startPost = useCallback(() => {
    chooseView("feed");
    requestAnimationFrame(() => draftRef.current?.focus());
  }, [chooseView]);

  const focusSearch = useCallback(() => {
    const field = mobileSearchRef.current;
    field?.scrollIntoView({ block: "center", behavior: "smooth" });
    field?.focus();
  }, []);

  useAgentTools(
    useCallback((text: string) => {
      setView("feed");
      setSearch("");
      setQuery("");
      setProfileHandle("");
      setPostId("");
      setProfileTab("posts");
      setDraft(text);
      history.replaceState(null, "", "/");
      requestAnimationFrame(() => draftRef.current?.focus());
    }, []),
  );

  // Optimistic like and save. The post flips straight away and flips back if
  // the server disagrees.
  const react = useCallback(
    (post: Post, kind: "like" | "save") => {
      if (!requireUser()) return;
      const active = kind === "like" ? post.liked : post.saved;
      const next = active ? 0 : 1;
      const optimistic: Partial<Post> =
        kind === "like"
          ? { liked: next, likes: Math.max(0, post.likes + (next ? 1 : -1)) }
          : { saved: next };
      const rollback: Partial<Post> =
        kind === "like"
          ? { liked: post.liked, likes: post.likes }
          : { saved: post.saved };
      patchPost(post.id, optimistic);
      void run(kind + ":" + post.id, async () => {
        try {
          await api(kind + "/" + post.id, {
            method: next ? "PUT" : "DELETE",
          });
          if (kind === "save") {
            toast.success(next ? "Saved for later." : "Removed from saved posts.");
            if (!next && savedTab) removePost(post.id);
          }
        } catch (cause) {
          patchPost(post.id, rollback);
          throw cause;
        }
      });
    },
    [patchPost, removePost, requireUser, run, savedTab],
  );

  const like = useCallback((post: Post) => react(post, "like"), [react]);
  const save = useCallback((post: Post) => react(post, "save"), [react]);

  const follow = useCallback(
    (person: Profile) => {
      if (!requireUser()) return;
      const next = person.following ? 0 : 1;
      const apply = (value: number) => {
        patchPersonFollowing(person.id, value);
        patchProfileFollowing(person.id, value);
        bumpFollowingCount(viewerId, value ? 1 : -1);
      };
      apply(next);
      void run("follow:" + person.id, async () => {
        try {
          await api("follow/" + person.id, {
            method: next ? "PUT" : "DELETE",
          });
          toast.success(
            next
              ? "You’re right behind " + person.name + "."
              : "You’re going your own way.",
          );
          if (followingFeed) revalidateFeed();
        } catch (cause) {
          apply(next ? 0 : 1);
          throw cause;
        }
      });
    },
    [
      bumpFollowingCount,
      followingFeed,
      patchPersonFollowing,
      patchProfileFollowing,
      requireUser,
      revalidateFeed,
      run,
      viewerId,
    ],
  );

  // A follow made inside the followers or following dialog: the dialog already
  // did the work, this only keeps the rest of the page in step.
  const syncFollow = useCallback(
    (person: Profile, following: number) => {
      patchPersonFollowing(person.id, following);
      patchProfileFollowing(person.id, following);
      bumpFollowingCount(viewerId, following ? 1 : -1);
      if (followingFeed) revalidateFeed();
    },
    [
      bumpFollowingCount,
      followingFeed,
      patchPersonFollowing,
      patchProfileFollowing,
      revalidateFeed,
      viewerId,
    ],
  );

  // Onboarding is done: the viewer, the feed and the rail are all a step
  // behind the follows just made, and Following is finally worth reading.
  const finishOnboarding = useCallback(() => {
    setOnboardingClosed(true);
    refreshViewer();
    revalidatePeople();
    // Switching the tab loads the Following feed on its own.
    chooseFeedTab("following");
    toast.success("Your Following feed is filling up.");
  }, [chooseFeedTab, refreshViewer, revalidatePeople]);

  const submitPost = useCallback(() => {
    if (!requireUser()) return;
    // Your own post does not show up in Following, so a post written there
    // lands you back on Everyone, where you can actually see it.
    const staying =
      view === "feed" && feedTab === "everyone" && !query && !postId;
    void run("post", async () => {
      await api("posts", {
        method: "POST",
        body: { body: draft, image: postImage },
      });
      setDraft("");
      setPostImage(null);
      setView("feed");
      setFeedTab("everyone");
      storeTab("everyone");
      setProfileHandle("");
      setProfileTab("posts");
      setPostId("");
      history.replaceState(null, "", "/");
      if (staying) revalidateFeed();
      toast.success("Your post has landed. 🍑");
    });
  }, [
    draft,
    feedTab,
    postImage,
    postId,
    query,
    requireUser,
    revalidateFeed,
    run,
    view,
  ]);

  const deletePost = useCallback(
    (post: Post) => {
      void run("delete:" + post.id, async () => {
        await api("posts/" + post.id, { method: "DELETE" });
        removePost(post.id);
        if (postId === post.id) exitSinglePost();
        revalidateFeed();
        toast.success("Post removed.");
      });
    },
    [exitSinglePost, postId, removePost, revalidateFeed, run],
  );

  const togglePin = useCallback(
    (post: Post) => {
      void run("pin:" + post.id, async () => {
        const result = await api<{ pinned: boolean }>(
          "admin/pin/" + post.id,
          { method: "POST" },
        );
        patchPost(post.id, { pinned: result.pinned ? 1 : 0 });
        revalidateFeed();
        toast.success(
          result.pinned
            ? "Pinned to the top of the feed."
            : "Unpinned. Back in the pile.",
        );
      });
    },
    [patchPost, revalidateFeed, run],
  );

  const blockAuthor = useCallback(
    (post: Post) => {
      if (!requireUser()) return;
      void run("block:" + post.user_id, async () => {
        await api("block/" + post.user_id, { method: "PUT" });
        revalidateFeed();
        revalidatePeople();
        toast.success(
          "You’ve left them behind. Manage blocks in your account menu.",
        );
      });
    },
    [requireUser, revalidateFeed, revalidatePeople, run],
  );

  const openReport = useCallback(
    (post: Post) => {
      if (!requireUser()) return;
      setReportPost(post);
      setModal("report");
    },
    [requireUser],
  );

  const openReplies = useCallback((post: Post) => {
    setReplyPost(post);
    setModal("replies");
  }, []);

  const share = useCallback((post: Post) => {
    const link = location.origin + "/?post=" + encodeURIComponent(post.id);
    setShareLink(link);
    const copying = navigator.clipboard?.writeText(link);
    if (!copying) {
      setShareOpen(true);
      return;
    }
    copying.then(
      () => toast.success("Post link copied."),
      () => setShareOpen(true),
    );
  }, []);

  const signOut = useCallback(() => {
    void run("logout", async () => {
      await api("logout", { method: "POST" });
      viewer.setUser(null);
      chooseView("feed");
      toast.success("See you on the backside.");
    });
  }, [chooseView, run, viewer]);

  const closeModal = useCallback(() => {
    setModal("");
    setRecoveryToken("");
    setSecurityNotice("");
  }, []);

  // A member who has not been through onboarding gets the follow nudge: after
  // signup once the welcome dialog is dismissed, and on any later visit. It
  // waits its turn, so it never lands on top of the email confirmation or any
  // other dialog that is already open, and once closed it stays closed for the
  // rest of this page load.
  const showOnboarding =
    !!user &&
    user.onboarded === false &&
    !onboardingClosed &&
    !modal &&
    !infoModal &&
    !welcomeEmail &&
    !confirmation;

  const otherHandle =
    view === "profile" &&
    profileView.profile &&
    profileView.profile.id !== viewerId
      ? profileView.profile.handle
      : "";

  // A search or a single post is answered by everybody, so that is the tab
  // the feed shows while one is open. The chosen tab is only parked, and comes
  // back the moment the search is cleared.
  const shownFeedTab =
    view === "feed" && (query || singlePostId) ? "everyone" : feedTab;
  const tab = view === "profile" ? profileTab : shownFeedTab;
  const heading = viewHeading(view, tab, profileView.profile?.name);
  const kicker = viewKicker(view, tab);

  // Nothing is decided until the viewer has been fetched and the address bar
  // read. One neutral paint beats a flash of the wrong front door.
  if (!viewer.ready || deepLink === null) {
    return <div className="landing-boot" role="status" aria-label="Loading Assbook" />;
  }

  // The dialogs sit beside the page, not inside it: the landing page and the
  // app both need them, and Radix puts them in a portal either way.
  const dialogs = (
    <>
      {modal === "auth" && (
        <AuthDialog
          initialMode={authMode}
          onAuthenticated={(fresh, mode, email) => {
            viewer.setUser(fresh);
            if (mode === "signup") {
              // New members land in the feed with one clear ask: open the
              // confirmation email. Everything else waits under Account security.
              setModal("");
              setWelcomeEmail(email);
            } else {
              setModal("");
              toast.success("Good to have you back.");
            }
          }}
          onRecover={() => {
            setRecoveryToken("");
            setModal("recover");
          }}
          onOpenRules={() => setInfoModal("rules")}
          onClose={closeModal}
        />
      )}
      {modal === "security" && user && (
        <AccountSecurityDialog
          notice={securityNotice}
          onSignedOut={() => {
            viewer.setUser(null);
            setSecurityNotice("");
            setAuthMode("login");
            setModal("auth");
            toast.success("Password changed. Please sign in again.");
          }}
          onClose={closeModal}
        />
      )}
      {welcomeEmail && (
        <WelcomeDialog email={welcomeEmail} onClose={() => setWelcomeEmail("")} />
      )}
      {showOnboarding && (
        <FollowOnboardingDialog
          selfId={user.id}
          onFollowed={syncFollow}
          onDone={finishOnboarding}
        />
      )}
      {confirmation && (
        <EmailConfirmedDialog
          state={confirmation}
          onSignIn={() => {
            setConfirmation(null);
            viewer.setUser(null);
            setAuthMode("login");
            setModal("auth");
          }}
          onClose={() => setConfirmation(null)}
        />
      )}
      {RECOVERY_MODES.includes(modal) && (
        <AccountRecoveryDialog
          mode={modal}
          token={recoveryToken}
          onRecover={() => {
            setRecoveryToken("");
            setModal("recover");
          }}
          onDone={(message) => {
            setRecoveryToken("");
            viewer.setUser(null);
            setAuthMode("login");
            setModal("auth");
            toast.success(message);
          }}
          onClose={closeModal}
        />
      )}
      {modal === "edit" && user && (
        <EditProfileDialog
          user={user}
          onSaved={(fresh) => {
            viewer.setUser(fresh);
            profileView.merge(fresh.id, {
              name: fresh.name,
              bio: fresh.bio,
              link: fresh.link ?? null,
              avatar: fresh.avatar,
            });
            revalidateFeed();
            setModal("");
            toast.success("Your best side, updated.");
          }}
          onClose={closeModal}
        />
      )}
      {modal === "upload" && (
        <PhotoUploadDialog
          target="post"
          onUse={(url) => {
            setPostImage(url);
            setModal("");
            toast.success("Photo attached. Press Post to share it.");
          }}
          onClose={closeModal}
        />
      )}
      {modal === "replies" && replyPost && (
        <RepliesDialog
          post={replyPost}
          viewer={user}
          now={now}
          onCountChange={(id, count) => patchPost(id, { comments: count })}
          onRequireUser={requireUser}
          onClose={closeModal}
        />
      )}
      {modal === "report" && reportPost && (
        <ReportDialog post={reportPost} onClose={closeModal} />
      )}
      {followList && profileView.profile && (
        <FollowListDialog
          key={followList + ":" + profileView.profile.handle}
          mode={followList}
          handle={profileView.profile.handle}
          name={profileView.profile.name}
          isSelf={profileView.profile.id === viewerId}
          viewerId={viewerId}
          onVisit={visitProfile}
          onRequireUser={requireUser}
          onFollowed={syncFollow}
          onClose={() => setFollowList("")}
        />
      )}
      {modal === "blocked" && (
        <BlockedDialog
          onUnblocked={() => {
            revalidateFeed();
            revalidatePeople();
          }}
          onClose={closeModal}
        />
      )}
      {modal === "moderation" && (
        <ModerationQueueDialog
          now={now}
          onResolved={revalidateFeed}
          onClose={closeModal}
        />
      )}
      {infoModal === "rules" && <RulesDialog onClose={() => setInfoModal("")} />}
      {infoModal === "source" && (
        <SourceDialog
          onOpenRules={() => setInfoModal("rules")}
          onClose={() => setInfoModal("")}
        />
      )}
      {shareOpen && (
        <ShareDialog link={shareLink} onClose={() => setShareOpen(false)} />
      )}
    </>
  );

  if (landing) {
    return (
      <>
        <LandingPage
          onJoin={() => {
            setAuthMode("signup");
            setModal("auth");
          }}
          onSignIn={() => {
            setAuthMode("login");
            setModal("auth");
          }}
        />
        {dialogs}
      </>
    );
  }

  return (
    <>
      <AppShell
        user={user}
        view={view === "profile" && !ownProfile ? "" : view}
        search={search}
        searchPeople={peopleSearch.people}
        searched={peopleSearch.searched}
        onSearch={onSearch}
        onChooseView={chooseView}
        onVisitProfile={visitProfile}
        onEditProfile={() => setModal("edit")}
        onOpenSecurity={() => setModal("security")}
        onOpenBlocked={() => setModal("blocked")}
        onOpenModeration={() => setModal("moderation")}
        onSignOut={signOut}
        onJoin={() => {
          setAuthMode("signup");
          setModal("auth");
        }}
        onSignIn={() => {
          setAuthMode("login");
          setModal("auth");
        }}
        onOpenRules={() => setInfoModal("rules")}
        onOpenSource={() => setInfoModal("source")}
        onCompose={startPost}
        onFocusSearch={focusSearch}
        rail={
          <>
            <TopPostsCard posts={topPosts} onOpenPost={openPost} />
            <PeopleRail
              people={people.people}
              loading={people.loading}
              error={people.error}
              onRetry={people.retry}
              onVisit={visitProfile}
              onFollow={follow}
              pending={pending}
              onOpenAll={() => chooseView("community")}
            />
          </>
        }
      >
        <section className="intro">
          <div>
            {kicker && <div className="eyebrow">{kicker}</div>}
            <h1>
              {heading}
              <span aria-hidden="true">.</span>
            </h1>
            <p>{viewBlurb(view, tab)}</p>
          </div>
          <span className="intro-stamp" aria-hidden="true">
            100%<small>cheeky</small>
          </span>
        </section>
        <SearchField
          value={search}
          onChange={onSearch}
          variant="mobile"
          inputRef={mobileSearchRef}
          people={peopleSearch.people}
          searched={peopleSearch.searched}
          onSelectPerson={visitProfile}
        />
        {viewer.error && (
          <div className="state-card" role="alert">
            <p>Could not load your account. {viewer.error}</p>
            <button className="quiet" onClick={viewer.retry}>
              <RefreshCw size={16} aria-hidden="true" />
              Try again
            </button>
          </div>
        )}
        {view === "profile" && (
          <ProfileCard
            profile={profileView.profile}
            viewer={user}
            loading={profileView.loading}
            error={profileView.error}
            onRetry={profileView.retry}
            onEdit={() => setModal("edit")}
            onOpenSecurity={() => setModal("security")}
            onOpenFollowers={() => setFollowList("followers")}
            onOpenFollowing={() => setFollowList("following")}
            tab={profileTab}
            onTab={(next) => setProfileTab(next === "saved" ? "saved" : "posts")}
            onFollow={follow}
            followPending={pending.has(
              "follow:" + (profileView.profile?.id ?? ""),
            )}
          />
        )}
        {view === "feed" && !query && !postId && (
          <Composer
            user={user}
            draft={draft}
            onDraftChange={setDraft}
            image={postImage}
            onRemoveImage={() => setPostImage(null)}
            onAddPhoto={() => {
              if (requireUser()) setModal("upload");
            }}
            onSubmit={submitPost}
            submitting={pending.has("post")}
            textareaRef={draftRef}
          />
        )}
        {view === "community" ? (
          <PeopleView
            people={people.people}
            loading={people.loading}
            error={people.error}
            onRetry={people.retry}
            onVisit={visitProfile}
            onFollow={follow}
            pending={pending}
          />
        ) : (
          <Feed
            ownProfile={ownProfile}
            posts={feed.posts}
            loading={feed.loading}
            updating={feed.updating}
            loadingMore={feed.loadingMore}
            hasMore={feed.hasMore}
            error={feed.error}
            onRetry={retryFeed}
            onLoadMore={loadMore}
            view={view}
            feedTab={shownFeedTab}
            savedTab={savedTab}
            query={query}
            viewer={user}
            now={now}
            pending={pending}
            singlePostId={singlePostId}
            otherHandle={otherHandle}
            onExitSinglePost={exitSinglePost}
            onFeedTab={chooseFeedTab}
            onCompose={startPost}
            onFindPeople={() => chooseView("community")}
            onLike={like}
            onSave={save}
            onReplies={openReplies}
            onShare={share}
            onVisitProfile={visitProfile}
            onDelete={deletePost}
            onReport={openReport}
            onBlock={blockAuthor}
            onPin={togglePin}
          />
        )}

      </AppShell>
      {dialogs}
    </>
  );
}
