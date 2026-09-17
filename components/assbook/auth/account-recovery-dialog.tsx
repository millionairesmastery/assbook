"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccountRecovery } from "@/app/account-security";

const COPY: Record<string, { title: string; description: string }> = {
  recover: {
    title: "Let’s get you back in.",
    description:
      "We’ll email a link if your address is verified on an account.",
  },
  reset: {
    title: "Choose a new password.",
    description: "A fresh password for your backside.",
  },
};

export function AccountRecoveryDialog({
  mode,
  token,
  onRecover,
  onDone,
  onClose,
}: {
  mode: string;
  token: string;
  onRecover: () => void;
  onDone: (message: string) => void;
  onClose: () => void;
}) {
  const copy = COPY[mode] ?? COPY.recover;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="assbook-dialog">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <AccountRecovery
          key={mode}
          mode={mode}
          token={token}
          recover={onRecover}
          done={onDone}
        />
      </DialogContent>
    </Dialog>
  );
}
