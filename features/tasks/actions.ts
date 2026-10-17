
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  projectId: string | null
) {
  if (!projectId) {
    return true;
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ownerId: userId,
    },
    select: {
      id: true,
    },
  });

  return project !== null;
}

function refreshTaskPages() {
  revalidatePath("/tasks");
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

// =======================================
// CREATE
// =======================================

export async function createTask(formData: FormData) {
  const { user } = await getMyAccount();
  const fields = readTaskFields(formData);

  if (!fields) {
    redirect("/tasks?error=invalid_input");
  }

  if (!(await ownsProject(user.id, fields.projectId))) {
    redirect("/tasks?error=invalid_project");
  }

  await prisma.task.create({
    data: {
      ownerId: user.id,
      ...fields,
    },
  });

  refreshTaskPages();
  redirect("/tasks?status=created");
}

// =======================================
// UPDATE
// =======================================

export async function updateTask(formData: FormData) {
  const { user } = await getMyAccount();
  const taskId = readTaskId(formData);
  const fields = readTaskFields(formData);

  if (!taskId || !fields) {
    redirect("/tasks?error=invalid_input");
  }

  if (!(await ownsProject(user.id, fields.projectId))) {
    redirect("/tasks?error=invalid_project");
  }

  const result = await prisma.task.updateMany({
    where: {
      id: taskId,
      ownerId: user.id,
    },
    data: fields,
  });

  if (result.count === 0) {
    redirect("/tasks?error=not_found");
  }

  refreshTaskPages();
  redirect("/tasks?status=updated");
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
    redirect("/tasks?error=invalid_input");
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
    redirect("/tasks?error=not_found");
  }

  refreshTaskPages();
  redirect("/tasks?status=updated");
}

// =======================================
// DELETE
// =======================================

export async function deleteTask(formData: FormData) {
  const { user } = await getMyAccount();
  const taskId = readTaskId(formData);

  if (!taskId) {
    redirect("/tasks?error=invalid_input");
  }

  const result = await prisma.task.deleteMany({
    where: {
      id: taskId,
      ownerId: user.id,
    },
  });

  if (result.count === 0) {
    redirect("/tasks?error=not_found");
  }

  refreshTaskPages();
  redirect("/tasks?status=deleted");
}
