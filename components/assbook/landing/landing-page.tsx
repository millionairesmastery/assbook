"use client";
import { BadgeCheck, Heart, Shield, Users } from "lucide-react";
import { Toaster } from "sonner";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

const features = [
  { icon: Shield, label: "Fully clothed, always" },
  { icon: Users, label: "Real people, real backsides" },
  { icon: BadgeCheck, label: "Every photo checked" },
  { icon: Heart, label: "Bad puns encouraged" },
];

// What a visitor sees before they have an account: one screenful, no scroll.
// The illustration is drawn in CSS rather than screenshotted, so it stays
// truthful when the app changes and costs nothing to load.
export function LandingPage({
  onJoin,
  onSignIn,
}: {
  onJoin: () => void;
  onSignIn: () => void;
}) {
  return (
    <div className="landing">
      <Toaster position="bottom-center" richColors />
      <SiteHeader onJoin={onJoin} onSignIn={onSignIn} />
      <main className="landing-hero" id="main-content">
        <div className="landing-copy">
          <p className="eyebrow">THE INTERNET’S OTHER SIDE</p>
          <h1>
            The Bottom Line
            <span aria-hidden="true">.</span>
          </h1>
          <p className="landing-tagline">Good people. Bad puns. Great jeans.</p>
          <p className="landing-blurb">
            A small social network with one ridiculous rule: your profile photo
            is your own fully clothed behind. Everything else is normal: posts,
            replies, likes, people worth following.
          </p>
          <div className="landing-actions">
            <button type="button" className="primary" onClick={onJoin}>
              Join the backside
            </button>
            <button type="button" className="text-link" onClick={onSignIn}>
              Already here? Sign in
            </button>
          </div>
          <ul className="landing-features">
            {features.map(({ icon: Icon, label }) => (
              <li key={label}>
                <Icon size={17} aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>
        <div className="landing-art" aria-hidden="true">
          <div className="mini-profile">
            <div className="mini-profile-top">
              <span className="mini-avatar">👖</span>
              <span className="mini-who">
                <b>The Assbook crew</b>
                <small>@welcome</small>
              </span>
            </div>
            <p className="mini-stats">Posts 12 · Followers 340 · Following 87</p>
          </div>
          <div className="mini-phone">
            <div className="mini-phone-bar">
              <span className="mini-brandmark">🍑</span>
              assbook
            </div>
            <div className="mini-feed">
              <article className="mini-post">
                <header>
                  <span className="mini-avatar">👖</span>
                  <b>The Assbook crew</b>
                </header>
                <p>
                  We turned our backs on traditional social media. Literally.
                </p>
                <img
                  src="/street-style-friends.png"
                  alt="Three friends photographed from behind in denim and street style."
                  loading="lazy"
                  decoding="async"
                />
                <footer>128 likes · 12 replies</footer>
              </article>
              <article className="mini-post">
                <header>
                  <span className="mini-avatar">🩳</span>
                  <b>Jean Claude</b>
                </header>
                <p>Finally, a platform where being behind is a good thing.</p>
                <footer>64 likes · 5 replies</footer>
              </article>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
