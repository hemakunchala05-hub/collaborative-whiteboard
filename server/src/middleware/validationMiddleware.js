import { z } from "zod";

const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const registerSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80),
    email: emailSchema,
    password: z.string().min(8).max(128),
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export const validateRequest = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: result.error.issues.map(({ path, message, code }) => ({
        field: path.join("."),
        message,
        code,
      })),
    });
  }

  req.body = result.data;
  return next();
};
