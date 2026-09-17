"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/assbook/app-shell";
import { SearchField } from "@/components/assbook/search-field";
import { useAgentTools } from "@/components/assbook/agent-tools";
import { Feed } from "@/components/assbook/feed/feed";
import { Composer } from "@/components/assbook/composer/composer";
import { PhotoUploadDialog } from "@/components/assbook/composer/photo-upload-dialog";
import { ProfileCard } from "@/components/assbook/profile/profile-card";
import { EditProfileDialog } from "@/components/assbook/profile/edit-profile-dialog";
import { PeopleRail } from "@/components/assbook/people/people-rail";
import { PeopleDialog } from "@/components/assbook/people/people-dialog";
import { BlockedDialog } from "@/components/assbook/people/blocked-dialog";
import { AuthDialog } from "@/components/assbook/auth/auth-dialog";
import { AccountSecurityDialog } from "@/components/assbook/auth/account-security-dialog";
import { AccountRecoveryDialog } from "@/components/assbook/auth/account-recovery-dialog";
import { WelcomeDialog } from "@/components/assbook/auth/welcome-dialog";
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
import { privateViews, viewBlurb, viewHeading } from "@/components/assbook/nav-items";
import { useAsyncAction } from "@/hooks/use-async-action";
import { useFeed } from "@/hooks/use-feed";
import { useNow } from "@/hooks/use-now";
import { usePeople } from "@/hooks/use-people";
import { useProfile } from "@/hooks/use-profile";
import { useViewer } from "@/hooks/use-viewer";
import { api, errorMessage } from "@/lib/api-client";
import type { Post, Profile } from "@/lib/types";

const RECOVERY_MODES = ["recover", "reset"];

export default function Assbook() {
  const viewer = useViewer();
  const user = viewer.user;
  const viewerId = user?.id ?? "";
  const now = useNow();
  const action = useAsyncAction();

  const [view, setView] = useState("everyone");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [profileHandle, setProfileHandle] = useState("");
  const [postId, setPostId] = useState("");

  const [modal, setModal] = useState("");
  const [infoModal, setInfoModal] = useState("");
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [securityNotice, setSecurityNotice] = useState("");
  const [recoveryToken, setRecoveryToken] = useState("");
  const [welcomeEmail, setWelcomeEmail] = useState("");
  const [confirmation, setConfirmation] = useState<EmailConfirmation | null>(
    null,
  );
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
  const singlePostId = view === "everyone" && !query ? postId : "";

  const feed = useFeed({
    view,
    query,
    profileTarget: view === "profile" ? profileTarget || "__none__" : "",
    singlePostId,
    viewerId,
    ready: viewer.ready,
  });
  const people = usePeople(viewerId, viewer.ready);
  const profileView = useProfile(profileTarget, viewerId, viewer.ready);

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
  const { patchFollowing: patchProfileFollowing } = profileView;

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
    const readSearch = () => {
      const params = new URLSearchParams(location.search);
      const handle = params.get("profile");
      const single = params.get("post");
      if (handle) {
        setProfileHandle(handle);
        setView("profile");
      } else if (single) {
        setPostId(single);
      }
    };
    readSearch();
    readFragment();
    window.addEventListener("hashchange", readFragment);
    return () => window.removeEventListener("hashchange", readFragment);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

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
      history.replaceState(null, "", "/");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [requireUser],
  );

  const visitProfile = useCallback((handle: string) => {
    setView("profile");
    setProfileHandle(handle);
    setSearch("");
    setQuery("");
    setPostId("");
    history.replaceState(null, "", "/?profile=" + encodeURIComponent(handle));
    window.scrollTo({ top: 0, behavior: "smooth" });
    setModal("");
  }, []);

  const onSearch = useCallback((next: string) => {
    setSearch(next);
    setView("everyone");
    setProfileHandle("");
    setPostId("");
    history.replaceState(null, "", "/");
  }, []);

  const exitSinglePost = useCallback(() => {
    setPostId("");
    history.replaceState(null, "", "/");
  }, []);

  const startPost = useCallback(() => {
    chooseView("everyone");
    requestAnimationFrame(() => draftRef.current?.focus());
  }, [chooseView]);

  const focusSearch = useCallback(() => {
    const field = mobileSearchRef.current;
    field?.scrollIntoView({ block: "center", behavior: "smooth" });
    field?.focus();
  }, []);

  useAgentTools(
    useCallback((text: string) => {
      setView("everyone");
      setSearch("");
      setQuery("");
      setProfileHandle("");
      setPostId("");
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
            if (!next && view === "saved") removePost(post.id);
          }
        } catch (cause) {
          patchPost(post.id, rollback);
          throw cause;
        }
      });
    },
    [patchPost, removePost, requireUser, run, view],
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
          if (view === "following") revalidateFeed();
        } catch (cause) {
          apply(next ? 0 : 1);
          throw cause;
        }
      });
    },
    [
      patchPersonFollowing,
      patchProfileFollowing,
      requireUser,
      revalidateFeed,
      run,
      view,
    ],
  );

  const submitPost = useCallback(() => {
    if (!requireUser()) return;
    const staying = view === "everyone" && !query && !postId;
    void run("post", async () => {
      await api("posts", {
        method: "POST",
        body: { body: draft, image: postImage },
      });
      setDraft("");
      setPostImage(null);
      setView("everyone");
      setProfileHandle("");
      setPostId("");
      history.replaceState(null, "", "/");
      if (staying) revalidateFeed();
      toast.success("Your post has landed. 🍑");
    });
  }, [draft, postImage, postId, query, requireUser, revalidateFeed, run, view]);

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
      chooseView("everyone");
      toast.success("See you on the backside.");
    });
  }, [chooseView, run, viewer]);

  const closeModal = useCallback(() => {
    setModal("");
    setRecoveryToken("");
    setSecurityNotice("");
  }, []);

  const otherHandle =
    view === "profile" &&
    profileView.profile &&
    profileView.profile.id !== viewerId
      ? profileView.profile.handle
      : "";

  const heading = viewHeading(view, profileView.profile?.name);

  return (
    <AppShell
      user={user}
      view={view}
      search={search}
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
      onOpenRules={() => setInfoModal("rules")}
      onOpenSource={() => setInfoModal("source")}
      onCompose={startPost}
      onFocusSearch={focusSearch}
      rail={
        <PeopleRail
          people={people.people}
          loading={people.loading}
          error={people.error}
          onRetry={people.retry}
          onVisit={visitProfile}
          onFollow={follow}
          pending={pending}
          onOpenAll={() => setModal("people")}
        />
      }
    >
      <section className="intro">
        <div>
          <div className="eyebrow">THE INTERNET’S OTHER SIDE</div>
          <h1>
            {heading}
            <span aria-hidden="true">.</span>
          </h1>
          <p>{viewBlurb(view)}</p>
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
          onFollow={follow}
          followPending={pending.has(
            "follow:" + (profileView.profile?.id ?? ""),
          )}
        />
      )}
      {view === "everyone" && !query && (
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
      <Feed
        posts={feed.posts}
        loading={feed.loading}
        updating={feed.updating}
        loadingMore={feed.loadingMore}
        hasMore={feed.hasMore}
        error={feed.error}
        onRetry={retryFeed}
        onLoadMore={loadMore}
        view={view}
        query={query}
        viewer={user}
        now={now}
        pending={pending}
        singlePostId={singlePostId}
        otherHandle={otherHandle}
        onExitSinglePost={exitSinglePost}
        onChooseView={chooseView}
        onCompose={startPost}
        onFindPeople={() => setModal("people")}
        onLike={like}
        onSave={save}
        onReplies={openReplies}
        onShare={share}
        onVisitProfile={visitProfile}
        onDelete={deletePost}
        onReport={openReport}
        onBlock={blockAuthor}
      />

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
      {modal === "people" && (
        <PeopleDialog
          people={people.people}
          loading={people.loading}
          error={people.error}
          onRetry={people.retry}
          onVisit={visitProfile}
          onFollow={follow}
          pending={pending}
          onClose={closeModal}
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
    </AppShell>
  );
}
