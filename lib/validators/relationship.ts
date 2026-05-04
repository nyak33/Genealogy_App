import { z } from "zod";

export const relationshipTypeSchema = z.enum([
  "father",
  "mother",
  "spouse",
  "child"
]);

export const relationshipIdSchema = z.object({
  id: z.string().uuid("Relationship ID must be a valid UUID")
});

export const profileRelationshipParamsSchema = z.object({
  id: z.string().uuid("Profile ID must be a valid UUID")
});

export const createRelationshipSchema = z
  .object({
    personId: z.string().uuid("Person ID must be a valid UUID"),
    relatedPersonId: z
      .string()
      .uuid("Related person ID must be a valid UUID"),
    relationshipType: relationshipTypeSchema,
    notes: z
      .preprocess(
        (value) => (value === "" ? undefined : value),
        z.string().optional().nullable()
      )
  })
  .strict()
  .refine((value) => value.personId !== value.relatedPersonId, {
    message: "A profile cannot be related to itself",
    path: ["relatedPersonId"]
  });

export type CreateRelationshipInput = z.infer<typeof createRelationshipSchema>;
export type RelationshipTypeInput = z.infer<typeof relationshipTypeSchema>;
