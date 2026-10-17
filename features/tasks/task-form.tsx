
import { Button } from "@/components/ui/button";

type ProjectOption = {
  id: string;
  name: string;
  isArchived: boolean;
};

type TaskFormValues = {
  id: string;
  title: string;
  description: string | null;
  projectId: string | null;
  status: string;
  priority: string;
  dueAt: Date | null;
};

type TaskFormProps = {
  action: (formData: FormData) => Promise<void>;
  projects: ProjectOption[];
  task?: TaskFormValues;
  submitLabel: string;
};

const inputClass =
  "mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TaskForm({
  action,
  projects,
  task,
  submitLabel,
}: TaskFormProps) {
  const prefix = task?.id ?? "new";

  return (
    <form action={action} className="space-y-5">
      {task && (
        <input
          type="hidden"
          name="taskId"
          value={task.id}
        />
      )}

      <div>
        <label
          htmlFor={`${prefix}-title`}
          className="block text-sm font-medium"
        >
          Task Title
        </label>

        <input
          id={`${prefix}-title`}
          name="title"
          type="text"
          required
          maxLength={200}
          defaultValue={task?.title ?? ""}
          placeholder="e.g. Finish project report"
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor={`${prefix}-description`}
          className="block text-sm font-medium"
        >
          Description (optional)
        </label>

        <textarea
          id={`${prefix}-description`}
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={task?.description ?? ""}
          placeholder="Additional details..."
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor={`${prefix}-project`}
          className="block text-sm font-medium"
        >
          Project
        </label>

        <select
          id={`${prefix}-project`}
          name="projectId"
          defaultValue={task?.projectId ?? ""}
          className={inputClass}
        >
          <option value="">No Project</option>

          {projects.map((project) => (
            <option
              key={project.id}
              value={project.id}
            >
              {project.name}
              {project.isArchived ? " (Archived)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${prefix}-status`}
            className="block text-sm font-medium"
          >
            Status
          </label>

          <select
            id={`${prefix}-status`}
            name="status"
            defaultValue={task?.status ?? "TODO"}
            className={inputClass}
          >
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div>
          <label
            htmlFor={`${prefix}-priority`}
            className="block text-sm font-medium"
          >
            Priority
          </label>

          <select
            id={`${prefix}-priority`}
            name="priority"
            defaultValue={task?.priority ?? "MEDIUM"}
            className={inputClass}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor={`${prefix}-due-date`}
          className="block text-sm font-medium"
        >
          Due Date (optional)
        </label>

        <input
          id={`${prefix}-due-date`}
          name="dueDate"
          type="date"
          defaultValue={
            task?.dueAt
              ? task.dueAt.toISOString().slice(0, 10)
              : ""
          }
          className={inputClass}
        />

        <p className="mt-2 text-xs text-muted-foreground">
          Date only. Time scheduling will be
          added in Daily Planner.
        </p>
      </div>

      <Button type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}
