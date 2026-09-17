"use client";
import { ArrowUpRight, Code2, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const SOURCE_URL = "https://github.com/millionairesmastery/assbook-public";

export function RulesDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="assbook-dialog">
        <DialogHeader>
          <DialogTitle>The house rules.</DialogTitle>
          <DialogDescription>
            A silly idea. A few sensible boundaries.
          </DialogDescription>
        </DialogHeader>
        <div className="rules-copy">
          <p>
            <b>1. Pants on. Always.</b>
            <br />
            Profile photos show your own fully clothed behind. No nudity or
            sexual content.
          </p>
          <p>
            <b>2. Your photo. Your permission.</b>
            <br />
            Share only photos you own and have permission to post. No secretly
            photographed strangers.
          </p>
          <p>
            <b>3. Be a good human.</b>
            <br />
            No harassment, body shaming, hate, or spam. The joke is the website,
            never somebody’s body.
          </p>
          <p>
            <b>4. See something off?</b>
            <br />
            Report a post from its menu, or block an account to leave it behind.
          </p>
          <p className="small muted">
            Uploaded photos are not automatically verified. This beta relies on
            community reports and moderator review.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SourceDialog({
  onOpenRules,
  onClose,
}: {
  onOpenRules: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="assbook-dialog">
        <DialogHeader>
          <DialogTitle>Open source. Pants on.</DialogTitle>
          <DialogDescription>
            A ridiculous idea, built for anyone to make their own.
          </DialogDescription>
        </DialogHeader>
        <div className="rules-copy">
          <div className="source-hero" aria-hidden="true">
            🍑 <Code2 size={32} />
          </div>
          <p>
            <b>The internet could use a little less seriousness.</b>
          </p>
          <p>
            Assbook is an open-source social network with one ridiculous rule:
            your profile photo is your own fully clothed behind.
          </p>
          <p>
            MIT-licensed. Free to use, modify, and self-host. Bring your own
            puns.
          </p>
          <a className="primary" href="/assbook-source.zip" download>
            <Download size={17} aria-hidden="true" />
            Download the source
          </a>
          <p className="small muted">
            Includes the app, Cloudflare setup guide, and contribution
            guidelines. Also on{" "}
            <a href={SOURCE_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
            .
          </p>
          <button className="text-link" onClick={onOpenRules}>
            Community rules <ArrowUpRight size={14} aria-hidden="true" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ShareDialog({
  link,
  onClose,
}: {
  link: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="assbook-dialog">
        <DialogHeader>
          <DialogTitle>Pass it around.</DialogTitle>
          <DialogDescription>
            Copy this link to share the post.
          </DialogDescription>
        </DialogHeader>
        <input
          className="share-input"
          aria-label="Post link"
          readOnly
          value={link}
          onFocus={(event) => event.target.select()}
        />
      </DialogContent>
    </Dialog>
  );
}
