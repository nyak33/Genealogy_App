import { z } from "zod";
import { createProfileSchema } from "@/lib/validators/profile";
import { relationshipTypeSchema } from "@/lib/validators/relationship";

export const quickAddRelativeParamsSchema = z.object({
  id: z.string().uuid("Profile ID must be a valid UUID")
});

export const quickAddRelativeSchema = z
  .object({
    relationshipType: relationshipTypeSchema,
    profile: createProfileSchema.omit({
      confirmCreateDifferentPerson: true
    }),
    confirmCreateDifferentPerson: z.boolean().optional(),
    childParentRole: z.enum(["father", "mother"]).optional(),
    confirmParentAgeWarning: z.boolean().optional()
  })
  .strict();

export type QuickAddRelativeInput = z.infer<typeof quickAddRelativeSchema>;
