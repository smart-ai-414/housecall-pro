import { z } from "zod";

export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .pipe(z.email("Enter a valid email address"))

  .transform((value) => value.trim().toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")

  .max(72, "Password must be 72 characters or fewer");

export const signInSchema = z.object({
  email: emailSchema,

  password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(120, "Name must be 120 characters or fewer")
    .transform((value) => value.trim()),
  email: emailSchema,
  password: passwordSchema,
  inviteCode: z
    .string()
    .min(1, "An invite code is required")
    .transform((value) => value.trim().toUpperCase()),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
