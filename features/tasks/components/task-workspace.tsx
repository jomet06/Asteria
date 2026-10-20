
"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  Archive,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  Inbox,
  Menu,
  Plus,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import type {
  WorkspaceActionResult,
} from "../action-feedback";

import type {
  PlannerActionResult,
} from "../daily-planner/actions";

import type {
  WorkspaceActions,
  WorkspaceProject,
  WorkspaceTask,
} from "../workspace-types";

import {
  filterWorkspaceTasks,
  readWorkspaceView,
  workspaceHref,
} from "../workspace-view";

import { TaskDetail } from "../task-form";
import { QuickAddTask } from "./quick-add-task";
import { TaskList } from "./task-list";
import { TodoSidebar } from "./todo-sidebar";
import { ProjectMenu } from "./project-manager";
import {
  ConfirmDialog,
  WorkspaceDialog,
} from "./workspace-dialog";

import { WorkspaceTheme } from "./workspace-theme";
import { feedbackMessages } from "./use-workspace-mutation";
import { useLocalToday } from "./use-local-today";

type Props = {
  tasks: WorkspaceTask[];
  projects: WorkspaceProject[];
  actions: WorkspaceActions;

  addTaskToDay?: (
    data: FormData
  ) => Promise<PlannerActionResult>;

  initialView?: string;
  initialMessage?: {
    kind: "status" | "error";
    text: string;
  };

  today: string;
};

export function TaskWorkspace({
  tasks,
  projects,
  actions,
  addTaskToDay,
  initialView = "all",
  initialMessage,
  today,
}: Props) {
  const params = useSearchParams();
  const localToday = useLocalToday(today);

  const values = params?.getAll("view");

  const requestedView = values
    ? readWorkspaceView(
        values.length > 1 ? values : values[0]
      )
    : initialView;

  const project = projects.find(
    (item) => item.id === requestedView
  );

  const unavailable =
    requestedView !== "all" &&
    requestedView !== "inbox" &&
    !project;

  const view = unavailable
    ? "all"
    : requestedView;

  const visible = filterWorkspaceTasks(
    tasks,
    view
  );

  const active = visible.filter(
    (task) =>
      task.status !== "DONE" &&
      task.status !== "CANCELLED"
  );

  const closed = visible.filter(
    (task) =>
      task.status === "DONE" ||
      task.status === "CANCELLED"
  );

  const title =
    project?.name ??
    (view === "inbox" ? "Inbox" : "All Tasks");

  const [navigationOpen, setNavigationOpen] =
    useState(false);

  const [showCompleted, setShowCompleted] =
    useState(false);

  const [selectedTaskId, setSelectedTaskId] =
    useState<string | null>(null);

  const selectedTask =
    tasks.find(
      (task) => task.id === selectedTaskId
    ) ?? null;

  const [dirty, setDirty] = useState(false);

  const [editingPending, setEditingPending] =
    useState(false);

  const [discardOpen, setDiscardOpen] =
    useState(false);

  const [message, setMessage] =
    useState(initialMessage);

  const composerRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const taskTriggerRef = useRef<HTMLElement | null>(null);
  const navigationTriggerRef =
    useRef<HTMLElement | null>(null);
  const discardTriggerRef =
    useRef<HTMLElement | null>(null);

  const completedId = useId();

  // ====================================
  // FEEDBACK
  // ====================================

  useEffect(() => {
    if (message?.kind !== "status") return;

    const timeout = window.setTimeout(
      () => setMessage(undefined),
      5000
    );

    return () => window.clearTimeout(timeout);
  }, [message]);

  // ====================================
  // WORKSPACE NAVIGATION
  // ====================================

  function navigate(next: string) {
    window.history.pushState(
      null,
      "",
      workspaceHref(next)
    );

    navigationTriggerRef.current =
      headingRef.current;

    setNavigationOpen(false);
    setMessage(undefined);

    requestAnimationFrame(() =>
      headingRef.current?.focus()
    );
  }

  const onResult = useCallback(
    (result: WorkspaceActionResult) => {
      setMessage({
        kind: result.kind,
        text:
          feedbackMessages[result.message] ??
          "Changes saved.",
      });

      if (
        result.message === "project_created" ||
        result.message === "project_deleted"
      ) {
        navigationTriggerRef.current =
          headingRef.current;

        setNavigationOpen(false);

        window.history.pushState(
          null,
          "",
          workspaceHref(result.view)
        );
      }
    },
    []
  );

  function focusComposer() {
    composerRef.current?.scrollIntoView({
      block: "center",
    });

    composerRef.current?.focus();
  }

  // ====================================
  // QUICK ADD SHORTCUT
  // ====================================

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const isShortcut =
        event.key.toLowerCase() === "k" &&
        (event.metaKey || event.ctrlKey);

      const dialogOpen =
        document.querySelector(
          '[role="dialog"], [role="alertdialog"]'
        );

      if (
        isShortcut &&
        !selectedTask &&
        !navigationOpen &&
        !project?.isArchived &&
        !dialogOpen
      ) {
        event.preventDefault();

        composerRef.current?.scrollIntoView({
          block: "center",
        });

        composerRef.current?.focus();
      }
    }

    window.addEventListener(
      "keydown",
      shortcut
    );

    return () =>
      window.removeEventListener(
        "keydown",
        shortcut
      );
  }, [
    selectedTask,
    navigationOpen,
    project?.isArchived,
  ]);

  // ====================================
  // SHARED LIST PROPS
  // ====================================

  const listProps = {
    projects,
    view,
    today: localToday,
    actions,
    onResult,

    onOpen: (
      task: WorkspaceTask,
      trigger: HTMLButtonElement
    ) => {
      taskTriggerRef.current = trigger;

      setSelectedTaskId(task.id);
      setDirty(false);
    },

    onCompleted: () =>
      headingRef.current?.focus(),
  };

  const sidebar = (
    <TodoSidebar
      projects={projects}
      tasks={tasks}
      view={view}
      onNavigate={navigate}
      actions={actions}
      onResult={onResult}
    />
  );

  return (
    <div className="min-w-0 lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* DESKTOP SIDEBAR */}
      <div className="hidden min-h-[calc(100dvh-77px)] border-r border-border/60 bg-muted/20 px-4 py-7 lg:block">
        {sidebar}
      </div>

      {/* MAIN WORKSPACE */}
      <section
        aria-labelledby="workspace-title"
        className="mx-auto w-full min-w-0 max-w-4xl px-4 pt-3 pb-28 sm:px-8 sm:pt-10 lg:px-12 lg:pb-16"
      >
        <div className="mb-3 flex items-center justify-between gap-3 sm:mb-6">
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Your workspace
          </p>

          <div className="flex items-center gap-1">
            <span className="hidden text-xs text-muted-foreground lg:inline">
              Quick add{" "}
              <kbd className="ml-1 rounded border px-1.5 py-0.5 font-sans">
                Ctrl / ⌘ K
              </kbd>
            </span>

            <WorkspaceTheme />
          </div>
        </div>

        {/* HEADING */}
        <header className="mb-5 sm:mb-7">
          <div className="flex items-start justify-between gap-3">
            <h1
              ref={headingRef}
              tabIndex={-1}
              id="workspace-title"
              className="min-w-0 text-3xl font-semibold tracking-tight wrap-break-word outline-none sm:text-4xl"
            >
              {title}
            </h1>

            {project && (
              <ProjectMenu
                project={project}
                view={view}
                actions={actions}
                onResult={onResult}
              />
            )}
          </div>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {active.length > 0
              ? `${active.length} task${
                  active.length === 1 ? "" : "s"
                } to do`
              : "A little space to focus."}

            {closed.length > 0 && (
              <span>
                {" "}· {closed.length} completed or cancelled
              </span>
            )}
          </p>

          {project?.description && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground wrap-break-word">
              {project.description}
            </p>
          )}

          {/* NEW: DAILY PLANNER LINK */}
          <div className="mt-4">
            <Link
              href="/tasks/planner"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <CalendarDays className="size-4" />
              Open Daily Planner
            </Link>
          </div>
        </header>

        {/* WORKSPACE WARNINGS */}
        {unavailable && (
          <p
            role="alert"
            className="mb-5 rounded-lg bg-muted px-4 py-3 text-sm"
          >
            Project not found or access denied.
            Showing All Tasks.
          </p>
        )}

        {project?.isArchived && (
          <div className="mb-6 flex items-start gap-3 rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
            <Archive className="mt-0.5 size-4 shrink-0" />

            <p>
              <span className="font-medium text-foreground">
                Archived project.
              </span>{" "}
              You can still edit and complete tasks.
              Restore it from the project menu to add more.
            </p>
          </div>
        )}

        {/* QUICK ADD */}
        <div
          hidden={project?.isArchived}
          className="mb-7"
        >
          <QuickAddTask
            projects={projects}
            view={view}
            actions={actions}
            onResult={onResult}
            inputRef={composerRef}
          />
        </div>

        {/* ACTIVE TASKS */}
        {active.length ? (
          <>
            <div className="mb-2 flex items-center justify-between px-1 text-xs font-medium text-muted-foreground">
              <h2>To do</h2>
              <span>{active.length}</span>
            </div>

            <TaskList
              tasks={active}
              {...listProps}
            />
          </>
        ) : (
          <div className="px-4 py-12 text-center sm:py-16">
            <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl bg-muted/70 text-muted-foreground">
              {closed.length ? (
                <CheckCheck className="size-6" />
              ) : (
                <Inbox className="size-6" />
              )}
            </div>

            <h2 className="text-lg font-medium">
              {closed.length
                ? "All caught up"
                : view === "inbox"
                  ? "Your Inbox is empty"
                  : project
                    ? "A fresh start for this project"
                    : "Make room for what matters"}
            </h2>

            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
              {project?.isArchived
                ? "Restore this project whenever you’re ready to pick it up again."
                : closed.length
                  ? "Take a breath. Your finished tasks are tucked away below."
                  : view === "inbox"
                    ? "Capture a thought here. You can organize it into a project later."
                    : "Start with one small task. A title is all you need."}
            </p>

            {!project?.isArchived && (
              <Button
                variant="ghost"
                className="mt-4 min-h-11"
                onClick={focusComposer}
              >
                <Plus />
                Add your {closed.length ? "next" : "first"} task
              </Button>
            )}
          </div>
        )}

        {/* COMPLETED TASKS */}
        {closed.length > 0 && (
          <div className="mt-8">
            <button
              type="button"
              aria-expanded={showCompleted}
              aria-controls={completedId}
              onClick={() =>
                setShowCompleted(!showCompleted)
              }
              className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronDown
                className={`size-4 transition-transform ${
                  showCompleted ? "" : "-rotate-90"
                }`}
              />

              Completed & cancelled
              <span className="ml-1 text-xs">
                {closed.length}
              </span>
            </button>

            <div
              id={completedId}
              hidden={!showCompleted}
            >
              <TaskList
                tasks={closed}
                {...listProps}
                label="Completed and cancelled tasks"
              />
            </div>
          </div>
        )}
      </section>

      {/* MOBILE BOTTOM BAR */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t bg-background/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden">
        <Button
          variant="outline"
          className="h-11 flex-1"
          onClick={(event) => {
            navigationTriggerRef.current =
              event.currentTarget;

            setNavigationOpen(true);
          }}
        >
          <Menu />
          Views
        </Button>

        <Button
          className="h-11 flex-[2]"
          disabled={project?.isArchived}
          onClick={focusComposer}
        >
          <Plus />
          Add task
        </Button>
      </div>

      {/* FEEDBACK */}
      <div
        className="pointer-events-none fixed right-4 bottom-24 left-4 z-40 flex justify-center lg:bottom-6 lg:left-auto"
        role={
          message?.kind === "error"
            ? "alert"
            : "status"
        }
        aria-live={
          message?.kind === "error"
            ? "assertive"
            : "polite"
        }
        aria-atomic="true"
      >
        {message && (
          <div className="pointer-events-auto flex max-w-lg items-center gap-3 rounded-xl border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg">
            <Check className="size-4 shrink-0" />

            <span>{message.text}</span>

            <Button
              variant="ghost"
              size="icon"
              aria-label="Dismiss notification"
              onClick={() => setMessage(undefined)}
            >
              <X />
            </Button>
          </div>
        )}
      </div>

      {/* MOBILE NAVIGATION DRAWER */}
      <WorkspaceDialog
        open={navigationOpen}
        onOpenChange={setNavigationOpen}
        title="Your workspace"
        description="Choose a view or manage your projects."
        variant="sheet"
        returnFocusRef={navigationTriggerRef}
      >
        {sidebar}
      </WorkspaceDialog>

      {/* TASK DETAIL DRAWER */}
      <WorkspaceDialog
        open={!!selectedTask}
        onOpenChange={(open) => {
          if (!open && !editingPending) {
            if (dirty) {
              discardTriggerRef.current =
                document.activeElement instanceof HTMLElement
                  ? document.activeElement
                  : null;

              setDiscardOpen(true);
            } else {
              setSelectedTaskId(null);
            }
          }
        }}
        title="Task details"
        description="Make space for the details. Changes are saved when you choose Save changes."
        variant="sheet"
        returnFocusRef={taskTriggerRef}
      >
        {selectedTask && (
          <TaskDetail
            key={selectedTask.id}
            task={selectedTask}
            projects={projects}
            view={view}
            today={localToday}
            addTaskToDay={addTaskToDay}
            actions={actions}
            onResult={onResult}
            onDirtyChange={setDirty}
            onPendingChange={setEditingPending}
            onClose={() => {
              taskTriggerRef.current =
                taskTriggerRef.current?.isConnected
                  ? taskTriggerRef.current
                  : headingRef.current;

              setSelectedTaskId(null);
              setDirty(false);
              setEditingPending(false);
            }}
          />
        )}
      </WorkspaceDialog>

      {/* UNSAVED CHANGES CONFIRMATION */}
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard unsaved changes?"
        description="Your edits haven’t been saved. Keep editing to finish this task."
        confirmLabel="Discard changes"
        returnFocusRef={discardTriggerRef}
        onConfirm={() => {
          setDiscardOpen(false);
          setSelectedTaskId(null);
          setDirty(false);
        }}
      />
    </div>
  );
}
