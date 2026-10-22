"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";

/** Disconnects in Asteria; does not revoke access in Google's account settings. */
export async function disconnectGoogleCalendar(): Promise<never> {
  const { user } = await getMyAccount();
  await prisma.googleCalendarConnection.deleteMany({
    where: { ownerId: user.id },
  });
  revalidatePath("/settings");
  redirect("/settings?google=disconnected");
}
