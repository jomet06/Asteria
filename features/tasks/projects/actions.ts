
"use server";

import { refreshWorkspace, workspaceFeedback } from "../action-feedback";
import { readWorkspaceView, uuidPattern } from "../workspace-view";

import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";

function readProjectId(formData: FormData) {
  const id = formData.get("projectId");

  if (typeof id !== "string" || !uuidPattern.test(id)) {
    return null;
  }

  return id;
}

function readProjectFields(formData: FormData) {
  const rawName = formData.get("name");
  const rawDescription = formData.get("description");

  if (
    typeof rawName !== "string" ||
    typeof rawDescription !== "string"
  ) {
    return null;
  }

  const name = rawName.trim();
  const description = rawDescription.trim();

  if (
    name.length < 1 ||
    name.length > 120 ||
    description.length > 1000
  ) {
    return null;
  }

  return {
    name,
    description: description || null,
  };
}

// CREATE
export async function createProject(formData: FormData) {
  const { user } = await getMyAccount();
  const fields = readProjectFields(formData);

  if (!fields) {
    return workspaceFeedback(formData, "error", "project_invalid_input");
  }

  const project = await prisma.project.create({
    data: {
      ownerId: user.id,
      ...fields,
    },
  });

  refreshWorkspace();
  return workspaceFeedback(formData, "status", "project_created", project.id);
}

// UPDATE
export async function updateProject(formData: FormData) {
  const { user } = await getMyAccount();
  const projectId = readProjectId(formData);
  const fields = readProjectFields(formData);

  if (!projectId || !fields) {
    return workspaceFeedback(formData, "error", "project_invalid_input");
  }

  const result = await prisma.project.updateMany({
    where: {
      id: projectId,
      ownerId: user.id,
    },
    data: fields,
  });

  if (result.count === 0) {
    return workspaceFeedback(formData, "error", "project_not_found");
  }

  refreshWorkspace();
  return workspaceFeedback(formData, "status", "project_updated");
}

// ARCHIVE / RESTORE
export async function setProjectArchived(formData: FormData) {
  const { user } = await getMyAccount();
  const projectId = readProjectId(formData);
  const archiveValue = formData.get("archive");

  if (
    !projectId ||
    (archiveValue !== "true" && archiveValue !== "false")
  ) {
    return workspaceFeedback(formData, "error", "project_invalid_input");
  }

  const isArchived = archiveValue === "true";

  const result = await prisma.project.updateMany({
    where: {
      id: projectId,
      ownerId: user.id,
    },
    data: {
      isArchived,
    },
  });

  if (result.count === 0) {
    return workspaceFeedback(formData, "error", "project_not_found");
  }

  refreshWorkspace();

  return workspaceFeedback(formData, "status", isArchived ? "project_archived" : "project_restored");
}

// DELETE
export async function deleteProject(formData: FormData) {
  const { user } = await getMyAccount();
  const projectId = readProjectId(formData);

  if (!projectId) {
    return workspaceFeedback(formData, "error", "project_invalid_input");
  }

  const result = await prisma.project.deleteMany({
    where: {
      id: projectId,
      ownerId: user.id,
    },
  });

  if (result.count === 0) {
    return workspaceFeedback(formData, "error", "project_not_found");
  }

  refreshWorkspace();
  const view = readWorkspaceView(formData.get("view"));
  return workspaceFeedback(
    formData, "status", "project_deleted", view === projectId ? "inbox" : view
  );
}
