import { z } from "zod";

export const profileMergeSchema = z
  .object({
    primaryId: z.uuid(),
    duplicateId: z.uuid()
  })
  .strict()
  .refine((value) => value.primaryId !== value.duplicateId, {
    message: "Primary and duplicate profiles must be different.",
    path: ["duplicateId"]
  });

export type ProfileMergeInput = z.infer<typeof profileMergeSchema>;
