
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    redirect("/projects?error=invalid_input");
  }

  await prisma.project.create({
    data: {
      ownerId: user.id,
      ...fields,
    },
  });

  revalidatePath("/projects");
  redirect("/projects?status=created");
}

// UPDATE
export async function updateProject(formData: FormData) {
  const { user } = await getMyAccount();
  const projectId = readProjectId(formData);
  const fields = readProjectFields(formData);

  if (!projectId || !fields) {
    redirect("/projects?error=invalid_input");
  }

  const result = await prisma.project.updateMany({
    where: {
      id: projectId,
      ownerId: user.id,
    },
    data: fields,
  });

  if (result.count === 0) {
    redirect("/projects?error=not_found");
  }

  revalidatePath("/projects");
  redirect("/projects?status=updated");
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
    redirect("/projects?error=invalid_input");
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
    redirect("/projects?error=not_found");
  }

  revalidatePath("/projects");

  redirect(
    isArchived
      ? "/projects?status=archived"
      : "/projects?status=restored"
  );
}

// DELETE
export async function deleteProject(formData: FormData) {
  const { user } = await getMyAccount();
  const projectId = readProjectId(formData);

  if (!projectId) {
    redirect("/projects?error=invalid_input");
  }

  const result = await prisma.project.deleteMany({
    where: {
      id: projectId,
      ownerId: user.id,
    },
  });

  if (result.count === 0) {
    redirect("/projects?error=not_found");
  }

  revalidatePath("/projects");
  redirect("/projects?status=deleted");
}
