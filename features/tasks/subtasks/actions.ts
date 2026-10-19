
"use server";

import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";
import {
  refreshWorkspace,
  workspaceFeedback,
} from "../action-feedback";
import { uuidPattern } from "../workspace-view";

// Validate a UUID from FormData.
function readId(formData: FormData, field: string) {
  const value = formData.get(field);

  if (
    typeof value !== "string" ||
    !uuidPattern.test(value)
  ) {
    return null;
  }

  return value;
}

// Validate Subtask title.
function readTitle(formData: FormData) {
  const rawTitle = formData.get("title");

  if (typeof rawTitle !== "string") {
    return null;
  }

  const title = rawTitle.trim();

  if (title.length === 0 || title.length > 200) {
    return null;
  }

  return title;
}

// ========================================
// CREATE SUBTASK
// ========================================

export async function createSubtask(formData: FormData) {
  const { user } = await getMyAccount();

  const taskId = readId(formData, "taskId");
  const title = readTitle(formData);

  if (!taskId || !title) {
    return workspaceFeedback(
      formData,
      "error",
      "subtask_invalid_input"
    );
  }

  // Verify the parent Task belongs to this user.
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      ownerId: user.id,
    },
    select: {
      id: true,
    },
  });

  if (!task) {
    return workspaceFeedback(
      formData,
      "error",
      "subtask_not_found"
    );
  }

  // Find the next available position.
  const existing = await prisma.subtask.aggregate({
    where: {
      taskId,
    },
    _max: {
      position: true,
    },
  });

  const nextPosition =
    (existing._max.position ?? -1) + 1;

  await prisma.subtask.create({
    data: {
      taskId,
      title,
      position: nextPosition,
    },
  });

  refreshWorkspace();

  return workspaceFeedback(
    formData,
    "status",
    "subtask_created"
  );
}

// ========================================
// UPDATE SUBTASK TITLE
// ========================================

export async function updateSubtask(formData: FormData) {
  const { user } = await getMyAccount();

  const taskId = readId(formData, "taskId");
  const subtaskId = readId(formData, "subtaskId");
  const title = readTitle(formData);

  if (!taskId || !subtaskId || !title) {
    return workspaceFeedback(
      formData,
      "error",
      "subtask_invalid_input"
    );
  }

  const result = await prisma.subtask.updateMany({
    where: {
      id: subtaskId,
      taskId,
      task: {
        is: {
          ownerId: user.id,
        },
      },
    },
    data: {
      title,
    },
  });

  if (result.count === 0) {
    return workspaceFeedback(
      formData,
      "error",
      "subtask_not_found"
    );
  }

  refreshWorkspace();

  return workspaceFeedback(
    formData,
    "status",
    "subtask_updated"
  );
}

// ========================================
// COMPLETE / REOPEN SUBTASK
// ========================================

export async function toggleSubtask(formData: FormData) {
  const { user } = await getMyAccount();

  const taskId = readId(formData, "taskId");
  const subtaskId = readId(formData, "subtaskId");
  const completed = formData.get("isCompleted");

  if (
    !taskId ||
    !subtaskId ||
    (completed !== "true" && completed !== "false")
  ) {
    return workspaceFeedback(
      formData,
      "error",
      "subtask_invalid_input"
    );
  }

  const result = await prisma.subtask.updateMany({
    where: {
      id: subtaskId,
      taskId,
      task: {
        is: {
          ownerId: user.id,
        },
      },
    },
    data: {
      isCompleted: completed === "true",
    },
  });

  if (result.count === 0) {
    return workspaceFeedback(
      formData,
      "error",
      "subtask_not_found"
    );
  }

  refreshWorkspace();

  return workspaceFeedback(
    formData,
    "status",
    "subtask_updated"
  );
}

// ========================================
// DELETE SUBTASK
// ========================================

export async function deleteSubtask(formData: FormData) {
  const { user } = await getMyAccount();

  const taskId = readId(formData, "taskId");
  const subtaskId = readId(formData, "subtaskId");

  if (!taskId || !subtaskId) {
    return workspaceFeedback(
      formData,
      "error",
      "subtask_invalid_input"
    );
  }

  const result = await prisma.subtask.deleteMany({
    where: {
      id: subtaskId,
      taskId,
      task: {
        is: {
          ownerId: user.id,
        },
      },
    },
  });

  if (result.count === 0) {
    return workspaceFeedback(
      formData,
      "error",
      "subtask_not_found"
    );
  }

  refreshWorkspace();

  return workspaceFeedback(
    formData,
    "status",
    "subtask_deleted"
  );
}
