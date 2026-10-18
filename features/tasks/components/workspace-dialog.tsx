"use client";

import { useId, type ReactNode, type RefObject } from "react";
import { AlertDialog, Dialog } from "radix-ui";
import { LoaderCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FocusRef = RefObject<HTMLElement | null>;

function restoreFocus(event: Event, target?: FocusRef) {
  if (target?.current?.isConnected) {
    event.preventDefault();
    target.current.focus();
  } else if (target) {
    const heading = document.getElementById("workspace-title");
    if (heading) {
      event.preventDefault();
      heading.focus();
    }
  }
}

export function WorkspaceDialog({
  open, onOpenChange, title, description, children, variant = "dialog", returnFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  variant?: "dialog" | "sheet";
  returnFocusRef?: FocusRef;
}) {
  const descriptionId = useId();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in motion-safe:data-[state=open]:duration-150" />
        <Dialog.Content
          aria-describedby={description ? descriptionId : undefined}
          onCloseAutoFocus={(event) => restoreFocus(event, returnFocusRef)}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden bg-background text-foreground shadow-2xl outline-none",
            variant === "sheet"
              ? "inset-y-0 right-0 w-full sm:max-w-lg sm:border-l motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-right-4 motion-safe:data-[state=open]:duration-200"
              : "top-1/2 left-1/2 max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in motion-safe:data-[state=open]:zoom-in-95 motion-safe:data-[state=open]:duration-150"
          )}
        >
          <header className="shrink-0 pt-5 pr-16 pb-4 pl-5 sm:pt-6 sm:pl-6">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="wrap-break-word text-lg font-semibold tracking-tight">{title}</Dialog.Title>
              {description && <Dialog.Description id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</Dialog.Description>}
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">{children}</div>
          <Dialog.Close asChild>
            <Button type="button" variant="ghost" size="icon" className="absolute top-3 right-3 size-11 sm:top-4 sm:right-4" aria-label={`Close ${title.toLowerCase()}`}>
              <X className="size-5" />
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel, onConfirm, pending = false, error, returnFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  error?: string;
  returnFocusRef?: FocusRef;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(value) => { if (!pending) onOpenChange(value); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
        <AlertDialog.Content
          aria-busy={pending}
          onCloseAutoFocus={(event) => restoreFocus(event, returnFocusRef)}
          onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
          className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-background p-6 text-foreground shadow-2xl outline-none"
        >
          <AlertDialog.Title className="wrap-break-word text-lg font-semibold tracking-tight">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</AlertDialog.Description>
          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <AlertDialog.Cancel asChild><Button type="button" variant="ghost" className="min-h-11 px-4" disabled={pending}>Cancel</Button></AlertDialog.Cancel>
            <Button type="button" variant="destructive" className="min-h-11 px-4" onClick={onConfirm} disabled={pending}>
              {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
              {pending ? "Deleting…" : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
