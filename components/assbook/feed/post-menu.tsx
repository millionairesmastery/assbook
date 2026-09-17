"use client";
import { useRef, useState } from "react";
import { Ban, Flag, MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/assbook/confirm-dialog";
import type { Post } from "@/lib/types";

export function PostMenu({
  post,
  isOwn,
  canEdit,
  canPin,
  pinPending,
  onEdit,
  onDelete,
  onReport,
  onBlock,
  onPin,
}: {
  post: Post;
  isOwn: boolean;
  canEdit: boolean;
  canPin: boolean;
  pinPending: boolean;
  onEdit: (post: Post) => void;
  onDelete: (post: Post) => void;
  onReport: (post: Post) => void;
  onBlock: (post: Post) => void;
  onPin: (post: Post) => void;
}) {
  const [confirming, setConfirming] = useState<"" | "delete" | "block">("");
  // Set synchronously on select so the menu does not pull focus back out of
  // the confirmation that is about to open.
  const opening = useRef(false);

  const ask = (which: "delete" | "block") => {
    opening.current = true;
    setConfirming(which);
  };

  // The official account speaks for Assbook itself, so there is nobody to
  // report it to and nobody to block.
  const isOfficial = post.official === 1;
  const pinned = post.pinned === 1;

  // Nothing to offer on somebody else's official post, so skip the menu.
  if (!canPin && !isOwn && isOfficial) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="icon-button menu-trigger"
            aria-label={"More options for post by " + post.name}
          >
            <MoreHorizontal size={18} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(event) => {
            if (opening.current) {
              opening.current = false;
              event.preventDefault();
            }
          }}
        >
          {canPin && (
            <DropdownMenuItem
              disabled={pinPending}
              onSelect={() => onPin(post)}
            >
              {pinned ? (
                <PinOff size={15} aria-hidden="true" />
              ) : (
                <Pin size={15} aria-hidden="true" />
              )}
              {pinned ? "Unpin" : "Pin to the top"}
            </DropdownMenuItem>
          )}
          {isOwn ? (
            <>
              {canEdit && (
                <DropdownMenuItem onSelect={() => onEdit(post)}>
                  <Pencil size={15} aria-hidden="true" />
                  Edit the words
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => ask("delete")}>
                <Trash2 size={15} aria-hidden="true" />
                Remove your post
              </DropdownMenuItem>
            </>
          ) : (
            !isOfficial && (
              <>
                <DropdownMenuItem onSelect={() => onReport(post)}>
                  <Flag size={15} aria-hidden="true" />
                  Report post
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => ask("block")}>
                  <Ban size={15} aria-hidden="true" />
                  Leave them behind (block)
                </DropdownMenuItem>
              </>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirming === "delete"}
        onOpenChange={(open) => !open && setConfirming("")}
        title="Remove this post?"
        description="It disappears from the feed for everyone. There is no undo, so give it one last look."
        confirmLabel="Remove it"
        onConfirm={() => {
          setConfirming("");
          onDelete(post);
        }}
      />
      <ConfirmDialog
        open={confirming === "block"}
        onOpenChange={(open) => !open && setConfirming("")}
        title={"Leave @" + post.handle + " behind?"}
        description="You will not see each other's posts, and you will both unfollow. You can undo this from Blocked accounts."
        confirmLabel="Block them"
        onConfirm={() => {
          setConfirming("");
          onBlock(post);
        }}
      />
    </>
  );
}
