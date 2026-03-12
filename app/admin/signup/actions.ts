"use server";

import { sendNewOrganizationAlert } from "@/lib/email";

export async function notifyNewOrganizationAlert(data: {
  name: string;
  city: string;
  contactName: string;
  contactPhone: string;
}) {
  return sendNewOrganizationAlert(data);
}
