import { z } from "zod";

const joinRoomSchema = z
  .object({
    roomCode: z
      .string()
      .trim()
      .min(1)
      .max(32)
      .transform((code) => code.toUpperCase()),
  })
  .strict();

const drawPermissionSchema = z.object({ canDraw: z.boolean() }).strict();
const presenterSchema = z
  .object({
    userId: z.string().regex(/^[a-f\d]{24}$/i),
  })
  .strict();

function validateBody(schema) {
  return (req, res, next) => {
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
}

export const validateJoinRoom = validateBody(joinRoomSchema);
export const validateDrawPermission = validateBody(drawPermissionSchema);
export const validatePresenter = validateBody(presenterSchema);
