"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccountSecurity } from "@/app/account-security";

export function AccountSecurityDialog({
  notice,
  onSignedOut,
  onClose,
}: {
  notice?: string;
  onSignedOut: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="assbook-dialog">
        <DialogHeader>
          <DialogTitle>Keep your account yours.</DialogTitle>
          <DialogDescription>
            Recovery email, password, and signed-in sessions.
          </DialogDescription>
        </DialogHeader>
        <AccountSecurity notice={notice} signedOut={onSignedOut} />
      </DialogContent>
    </Dialog>
  );
}
