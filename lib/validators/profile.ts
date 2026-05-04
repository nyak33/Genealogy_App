import { z } from "zod";

const optionalDateString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Date must be valid"
    })
    .optional()
    .nullable()
);

function cleanFullName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

const profileBaseSchema = z.object({
  fullName: z
    .string()
    .transform(cleanFullName)
    .refine((value) => value.length > 0, {
      message: "Full name is required"
    }),
  dateOfBirth: optionalDateString,
  dateOfDeath: optionalDateString,
  gender: z
    .preprocess(
      (value) => (value === "" ? undefined : value),
      z.enum(["male", "female", "unknown", "other"]).optional().nullable()
    ),
  notes: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().optional().nullable()
  ),
  isDeceased: z.boolean().optional()
});

export const createProfileSchema = profileBaseSchema
  .extend({
    confirmCreateDifferentPerson: z.boolean().optional()
  })
  .strict();

export const updateProfileSchema = profileBaseSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  });

export const profileSearchQuerySchema = z.object({
  q: z.string().optional().default("")
});

export const duplicateCheckSchema = profileBaseSchema
  .pick({
    fullName: true,
    dateOfBirth: true,
    dateOfDeath: true
  })
  .strict();

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type DuplicateCheckInput = z.infer<typeof duplicateCheckSchema>;
