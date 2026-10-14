
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";

const allowedTimezones = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "UTC",
];

export async function updateMyProfile(
  formData: FormData
) {
  // 1. Verify the currently logged-in user.
  const user = await requireUser();

  // 2. Read form inputs.
  const rawName = formData.get("displayName");
  const rawTimezone = formData.get("timezone");

  // 3. Validate input types.
  if (
    typeof rawName !== "string" ||
    typeof rawTimezone !== "string"
  ) {
    redirect("/settings?error=invalid_input");
  }

  const displayName = rawName.trim();

  // 4. Validate permitted values.
  if (
    displayName.length > 80 ||
    !allowedTimezones.includes(rawTimezone)
  ) {
    redirect("/settings?error=invalid_input");
  }

  // 5. Modify only the authenticated user's profile.
  await prisma.profile.upsert({
    where: {
      id: user.id,
    },
    update: {
      displayName: displayName || null,
      timezone: rawTimezone,
    },
    create: {
      id: user.id,
      displayName: displayName || null,
      timezone: rawTimezone,
    },
  });

  // 6. Refresh affected pages.
  revalidatePath("/dashboard");
  revalidatePath("/settings");

  redirect("/settings?status=saved");
}
