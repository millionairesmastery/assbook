import Link from "next/link";

// The compact header shared by the landing page and the legal pages. On the
// landing page the two controls open the dialog in place; everywhere else they
// are links back to the front door, which opens it on arrival.
export function SiteHeader({
  onSignIn,
  onJoin,
}: {
  onSignIn?: () => void;
  onJoin?: () => void;
}) {
  return (
    <header className="site-top">
      <Link className="brand" href="/">
        <span className="brandmark" aria-hidden="true">
          🍑
        </span>
        assbook
      </Link>
      <div className="site-top-auth">
        {onSignIn ? (
          <button type="button" className="ghost-button" onClick={onSignIn}>
            Sign in
          </button>
        ) : (
          <Link className="ghost-button" href="/?auth=login">
            Sign in
          </Link>
        )}
        {onJoin ? (
          <button type="button" className="primary" onClick={onJoin}>
            Join
          </button>
        ) : (
          <Link className="primary" href="/?auth=signup">
            Join
          </Link>
        )}
      </div>
    </header>
  );
}
