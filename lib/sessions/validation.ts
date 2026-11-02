import { z } from "zod";

const title = z
  .string()
  .trim()
  .min(1, "Session name is required.")
  .max(120, "Session name must be 120 characters or fewer.");

export const sessionTypeSchema = z.enum([
  "interview",
  "meeting",
  "general",
]);

export const createSessionSchema = z.object({
  title,
  sessionType: sessionTypeSchema,
});

export const updateSessionSchema = z
  .object({
    title: title.optional(),
    sessionType: sessionTypeSchema.optional(),
    action: z.enum(["start", "stop", "archive"]).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.sessionType !== undefined ||
      value.action !== undefined,
    "At least one session change is required.",
  );

export const sessionListStatusSchema = z.enum([
  "draft",
  "active",
  "completed",
  "archived",
]);

export function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid request.";
}
