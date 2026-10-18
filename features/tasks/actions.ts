
"use server";

import { refreshWorkspace, workspaceFeedback } from "./action-feedback";
import { uuidPattern } from "./workspace-view";

import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";

const statuses = [
  "TODO",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
] as const;

const priorities = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
] as const;

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T {
  return (
    typeof value === "string" &&
    allowed.some((item) => item === value)
  );
}

function readTaskId(formData: FormData) {
  const value = formData.get("taskId");

  return typeof value === "string" &&
    uuidPattern.test(value)
    ? value
    : null;
}

function readTaskFields(formData: FormData) {
  const titleValue = formData.get("title");
  const descriptionValue = formData.get("description");
  const projectValue = formData.get("projectId");
  const statusValue = formData.get("status");
  const priorityValue = formData.get("priority");
  const dueDateValue = formData.get("dueDate");

  if (
    typeof titleValue !== "string" ||
    typeof descriptionValue !== "string" ||
    typeof projectValue !== "string" ||
    typeof dueDateValue !== "string" ||
    !isOneOf(statusValue, statuses) ||
    !isOneOf(priorityValue, priorities)
  ) {
    return null;
  }

  const title = titleValue.trim();
  const description = descriptionValue.trim();

  if (
    title.length < 1 ||
    title.length > 200 ||
    description.length > 2000
  ) {
    return null;
  }

  if (
    projectValue !== "" &&
    !uuidPattern.test(projectValue)
  ) {
    return null;
  }

  // Accept only YYYY-MM-DD, or an empty date.
  if (
    dueDateValue !== "" &&
    !/^\d{4}-\d{2}-\d{2}$/.test(dueDateValue)
  ) {
    return null;
  }

  const dueAt = dueDateValue
    ? new Date(`${dueDateValue}T00:00:00.000Z`)
    : null;

  // Reject invalid dates like 2026-02-31.
  if (
    dueAt &&
    (
      Number.isNaN(dueAt.getTime()) ||
      dueAt.toISOString().slice(0, 10) !== dueDateValue
    )
  ) {
    return null;
  }

  return {
    title,
    description: description || null,
    projectId: projectValue || null,
    status: statusValue,
    priority: priorityValue,
    dueAt,
  };
}

async function ownsProject(
  userId: string,
  projectId: string | null,
  currentProjectId?: string | null
) {
  if (!projectId) {
    return true;
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ownerId: userId,
      // An edit may keep its current archived project, but cannot move into one.
      ...(projectId === currentProjectId ? {} : { isArchived: false }),
    },
    select: {
      id: true,
    },
  });

  return project !== null;
}

// =======================================
// CREATE
// =======================================

export async function createTask(formData: FormData) {
  const { user } = await getMyAccount();
  const fields = readTaskFields(formData);

  if (!fields) {
    return workspaceFeedback(formData, "error", "invalid_input");
  }

  if (!(await ownsProject(user.id, fields.projectId))) {
    return workspaceFeedback(formData, "error", "invalid_project");
  }

  await prisma.task.create({
    data: {
      ownerId: user.id,
      ...fields,
    },
  });

  refreshWorkspace();
  return workspaceFeedback(formData, "status", "created");
}

// =======================================
// UPDATE
// =======================================

export async function updateTask(formData: FormData) {
  const { user } = await getMyAccount();
  const taskId = readTaskId(formData);
  const fields = readTaskFields(formData);

  if (!taskId || !fields) {
    return workspaceFeedback(formData, "error", "invalid_input");
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, ownerId: user.id },
    select: { projectId: true },
  });

  if (!task) {
    return workspaceFeedback(formData, "error", "not_found");
  }

  if (!(await ownsProject(user.id, fields.projectId, task.projectId))) {
    return workspaceFeedback(formData, "error", "invalid_project");
  }

  const result = await prisma.task.updateMany({
    where: {
      id: taskId,
      ownerId: user.id,
    },
    data: fields,
  });

  if (result.count === 0) {
    return workspaceFeedback(formData, "error", "not_found");
  }

  refreshWorkspace();
  return workspaceFeedback(formData, "status", "updated");
}

// =======================================
// MARK COMPLETE / INCOMPLETE
// =======================================

export async function toggleTaskStatus(
  formData: FormData
) {
  const { user } = await getMyAccount();
  const taskId = readTaskId(formData);
  const nextStatus = formData.get("nextStatus");

  if (
    !taskId ||
    (nextStatus !== "DONE" && nextStatus !== "TODO")
  ) {
    return workspaceFeedback(formData, "error", "invalid_input");
  }

  const result = await prisma.task.updateMany({
    where: {
      id: taskId,
      ownerId: user.id,
    },
    data: {
      status: nextStatus,
    },
  });

  if (result.count === 0) {
    return workspaceFeedback(formData, "error", "not_found");
  }

  refreshWorkspace();
  return workspaceFeedback(formData, "status", "updated");
}

// =======================================
// DELETE
// =======================================

export async function deleteTask(formData: FormData) {
  const { user } = await getMyAccount();
  const taskId = readTaskId(formData);

  if (!taskId) {
    return workspaceFeedback(formData, "error", "invalid_input");
  }

  const result = await prisma.task.deleteMany({
    where: {
      id: taskId,
      ownerId: user.id,
    },
  });

  if (result.count === 0) {
    return workspaceFeedback(formData, "error", "not_found");
  }

  refreshWorkspace();
  return workspaceFeedback(formData, "status", "deleted");
}
