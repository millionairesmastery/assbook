import Link from "next/link";
import { socialLinks } from "./social-links";
import { legalLinks, SOURCE_URL } from "./site-links";

// The footer under the landing page and the legal pages. The social row only
// appears once somebody fills in an address in social-links.ts.
export function SiteFooter() {
  const social = socialLinks.filter((link) => link.href !== "");
  return (
    <footer className="site-footer">
      <div className="site-footer-left">
        <span>Assbook © 2026 · Fun by design, serious about safety and business.</span>
        {social.length > 0 && (
          <ul className="site-social">
            {social.map(({ name, href, icon: Icon }) => (
              <li key={name}>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={"Assbook on " + name}
                >
                  <Icon size={20} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
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
  );
}
