
"use client";

import { useState } from "react";
import {
  Check,
  Circle,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import type {
  WorkspaceActions,
  WorkspaceSubtask,
  OnWorkspaceResult,
} from "../workspace-types";

import { ConfirmDialog } from "./workspace-dialog";
import { useWorkspaceMutation } from "./use-workspace-mutation";

type Props = {
  taskId: string;
  view: string;
  subtasks: WorkspaceSubtask[];
  actions: WorkspaceActions;
  onResult: OnWorkspaceResult;
};

export function SubtaskSection({
  taskId,
  view,
  subtasks,
  actions,
  onResult,
}: Props) {
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(
    null
  );
  const [editTitle, setEditTitle] = useState("");

  const [deletingId, setDeletingId] = useState<
    string | null
  >(null);

  const creation = useWorkspaceMutation(onResult);
  const editing = useWorkspaceMutation(onResult);
  const toggling = useWorkspaceMutation(onResult);
  const deletion = useWorkspaceMutation(onResult);

  const completed = subtasks.filter(
    (item) => item.isCompleted
  ).length;

  const total = subtasks.length;

  const percentage =
    total === 0
      ? 0
      : Math.round((completed / total) * 100);

  const pending =
    creation.pending ||
    editing.pending ||
    toggling.pending ||
    deletion.pending;

  function makeData() {
    const data = new FormData();

    data.set("taskId", taskId);
    data.set("view", view);

    return data;
  }

  function addSubtask() {
    const title = newTitle.trim();

    if (!title || pending) return;

    const data = makeData();
    data.set("title", title);

    creation.run(actions.createSubtask, data, () => {
      setNewTitle("");
    });
  }

  function saveEdit() {
    const title = editTitle.trim();

    if (!title || !editingId || pending) return;

    const data = makeData();

    data.set("subtaskId", editingId);
    data.set("title", title);

    editing.run(actions.updateSubtask, data, () => {
      setEditingId(null);
      setEditTitle("");
    });
  }

  function toggle(item: WorkspaceSubtask) {
    if (pending) return;

    const data = makeData();

    data.set("subtaskId", item.id);
    data.set(
      "isCompleted",
      String(!item.isCompleted)
    );

    toggling.run(actions.toggleSubtask, data);
  }

  function remove() {
    if (!deletingId || pending) return;

    const data = makeData();

    data.set("subtaskId", deletingId);

    deletion.run(actions.deleteSubtask, data, () => {
      setDeletingId(null);
    });
  }

  return (
    <section
      aria-label="Subtasks"
      className="space-y-4 rounded-xl border p-4"
      onKeyDown={(event) => {
        // Prevent Ctrl+Enter from triggering
        // the parent Task Save shortcut.
        if (event.key === "Enter") {
          event.stopPropagation();
        }
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          Subtasks
        </h3>

        <span className="text-xs text-muted-foreground">
          {completed}/{total} completed
        </span>
      </div>

      {total > 0 && (
        <div
          role="progressbar"
          aria-label="Subtask progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      {total === 0 && (
        <p className="text-sm text-muted-foreground">
          No subtasks yet. Break this task into
          smaller steps.
        </p>
      )}

      <ul className="space-y-2">
        {subtasks.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              disabled={pending}
              onClick={() => toggle(item)}
              aria-label={
                item.isCompleted
                  ? `Reopen ${item.title}`
                  : `Complete ${item.title}`
              }
              aria-pressed={item.isCompleted}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
            >
              {item.isCompleted ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" />
                </span>
              ) : (
                <Circle className="size-5 text-muted-foreground" />
              )}
            </button>

            {editingId === item.id ? (
              <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                <input
                  aria-label="Edit subtask title"
                  type="text"
                  maxLength={200}
                  value={editTitle}
                  disabled={pending}
                  onChange={(event) =>
                    setEditTitle(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveEdit();
                    }
                    if (event.key === "Escape") {
                      setEditingId(null);
                    }
                  }}
                  className="min-h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                />

                <Button
                  type="button"
                  size="sm"
                  disabled={pending || !editTitle.trim()}
                  onClick={saveEdit}
                >
                  Save
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <span
                  className={`min-w-0 flex-1 break-words text-sm ${
                    item.isCompleted
                      ? "text-muted-foreground line-through"
                      : ""
                  }`}
                >
                  {item.title}
                </span>

                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={pending}
                  aria-label={`Edit ${item.title}`}
                  onClick={() => {
                    setEditingId(item.id);
                    setEditTitle(item.title);
                  }}
                >
                  <Pencil className="size-4" />
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={pending}
                  aria-label={`Delete ${item.title}`}
                  onClick={() => setDeletingId(item.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <input
          type="text"
          aria-label="New subtask"
          value={newTitle}
          maxLength={200}
          disabled={pending}
          placeholder="Add a subtask..."
          onChange={(event) =>
            setNewTitle(event.target.value)
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addSubtask();
            }
          }}
          className="min-h-11 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm"
        />

        <Button
          type="button"
          disabled={pending || !newTitle.trim()}
          onClick={addSubtask}
          aria-label="Add subtask"
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      {[
        creation.error,
        editing.error,
        toggling.error,
        deletion.error,
      ]
        .filter(Boolean)
        .map((error, index) => (
          <p
            key={index}
            role="alert"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        ))}

      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
        title="Delete subtask?"
        description="This subtask will be permanently deleted."
        confirmLabel="Delete subtask"
        pending={deletion.pending}
        error={deletion.error}
        onConfirm={remove}
      />
    </section>
  );
}
