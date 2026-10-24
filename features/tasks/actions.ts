
"use server";

import { refreshWorkspace, workspaceFeedback } from "./action-feedback";
import { readTaskFields, dependencyChainHasCycle } from "./task-fields";
import { uuidPattern } from "./workspace-view";

import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";

function readTaskId(formData: FormData) {
  const value = formData.get("taskId");

  return typeof value === "string" &&
    uuidPattern.test(value)
    ? value
    : null;
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

async function dependencyAllowed(
  formData: FormData,
  userId: string,
  taskId: string | null,
  dependsOnTaskId: string | null
) {
  if (!dependsOnTaskId) {
    return true;
  }

  if (dependsOnTaskId === taskId) {
    return false;
  }

  const dependency = await prisma.task.findFirst({
    where: { id: dependsOnTaskId, ownerId: userId },
    select: { dependsOnTaskId: true },
  });

  if (!dependency) {
    return false;
  }

  // A brand-new task cannot appear in an existing chain yet,
  // so the cycle walk only matters for updates.
  if (taskId && await dependencyChainHasCycle(taskId, dependsOnTaskId, async (id) => {
    const row = await prisma.task.findFirst({
      where: { id, ownerId: userId },
      select: { dependsOnTaskId: true },
    });
    return row?.dependsOnTaskId ?? null;
  })) {
    return false;
  }

  return true;
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

  if (!(await dependencyAllowed(formData, user.id, null, fields.dependsOnTaskId))) {
    return workspaceFeedback(formData, "error", "invalid_dependency");
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

  if (!(await dependencyAllowed(formData, user.id, taskId, fields.dependsOnTaskId))) {
    return workspaceFeedback(formData, "error", "invalid_dependency");
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
      // Completing a task completes its progress; reopening leaves it alone.
      ...(nextStatus === "DONE" ? { progress: 100 } : {}),
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
