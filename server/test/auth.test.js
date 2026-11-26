import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import {
  loginSchema,
  registerSchema,
  validateRequest,
} from "../src/middleware/validationMiddleware.js";
import verifyToken from "../src/middleware/authMiddleware.js";
import authorizeRoles from "../src/middleware/roleMiddleware.js";
import socketAuth from "../src/sockets/socketAuth.js";
import { logoutUser } from "../src/services/authService.js";

function createResponse() {
  return {
    statusCode: undefined,
    body: undefined,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("registration validation trims identity fields but preserves passwords", () => {
  assert.deepEqual(
    registerSchema.parse({
      displayName: "  Ada Lovelace ",
      email: " ADA@EXAMPLE.COM ",
      password: "  password123  ",
    }),
    {
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      password: "  password123  ",
    },
  );
});

test("registration and login reject invalid and unexpected fields", () => {
  assert.equal(
    registerSchema.safeParse({
      displayName: "A",
      email: "not-an-email",
      password: "short",
    }).success,
    false,
  );
  assert.equal(
    loginSchema.safeParse({
      email: "ada@example.com",
      password: "password123",
      userType: "Admin",
    }).success,
    false,
  );
});

test("validation middleware returns field errors and does not continue", () => {
  const res = createResponse();
  let nextCalled = false;

  validateRequest(loginSchema)(
    { body: { email: "invalid", password: "" } },
    res,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "Validation failed");
  assert.ok(res.body.details.some((issue) => issue.field === "email"));
  assert.equal(nextCalled, false);
});

test("validation middleware replaces the body with normalized data", () => {
  const req = { body: { email: " ADA@EXAMPLE.COM ", password: "password123" } };
  let nextCalled = false;

  validateRequest(loginSchema)(req, createResponse(), () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.body, {
    email: "ada@example.com",
    password: "password123",
  });
});

test("authorization rejects anonymous and disallowed users", () => {
  const authorizeRegistered = authorizeRoles("Registered");
  const anonymousResponse = createResponse();
  const forbiddenResponse = createResponse();

  authorizeRegistered({}, anonymousResponse, () => {
    assert.fail("anonymous request should not continue");
  });
  authorizeRegistered(
    { user: { userType: "Admin" } },
    forbiddenResponse,
    () => {
      assert.fail("disallowed role should not continue");
    },
  );

  assert.equal(anonymousResponse.statusCode, 401);
  assert.equal(forbiddenResponse.statusCode, 403);
});

test("authorization continues for an allowed user type", () => {
  let nextCalled = false;

  authorizeRoles("Registered")(
    { user: { userType: "Registered" } },
    createResponse(),
    () => {
      nextCalled = true;
    },
  );

  assert.equal(nextCalled, true);
});

test("token middleware rejects requests without a bearer token", async () => {
  const res = createResponse();
  let nextCalled = false;

  await verifyToken({ get: () => undefined }, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("token middleware attaches the active account from a valid token", async () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousFindById = User.findById;
  const secret = randomBytes(32).toString("hex");
  const userId = new mongoose.Types.ObjectId().toString();
  const mockUser = {
    _id: new mongoose.Types.ObjectId(userId),
    displayName: "Ada Lovelace",
    email: "ada@example.com",
    userType: "Registered",
    isActive: true,
    tokenVersion: 0,
  };
  process.env.JWT_SECRET = secret;
  User.findById = () => ({
    select() {
      return {
        async lean() {
          return mockUser;
        },
      };
    },
  });

  try {
    const req = {
      get: () =>
        `Bearer ${jwt.sign({ sub: userId, tokenVersion: 0 }, secret, {
          algorithm: "HS256",
        })}`,
    };
    let nextCalled = false;

    await verifyToken(req, createResponse(), () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.deepEqual(req.user, {
      id: userId,
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      userType: "Registered",
    });

    mockUser.tokenVersion = 1;
    const revokedResponse = createResponse();
    let revokedNextCalled = false;
    await verifyToken(req, revokedResponse, () => {
      revokedNextCalled = true;
    });
    assert.equal(revokedResponse.statusCode, 401);
    assert.equal(revokedNextCalled, false);
  } finally {
    User.findById = previousFindById;
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  }
});

test("logout increments the account token version", async () => {
  const previousFindByIdAndUpdate = User.findByIdAndUpdate;
  const userId = new mongoose.Types.ObjectId().toString();
  let update;
  User.findByIdAndUpdate = async (id, changes) => {
    assert.equal(id, userId);
    update = changes;
    return { _id: id };
  };

  try {
    await logoutUser(userId);
    assert.deepEqual(update, { $inc: { tokenVersion: 1 } });
  } finally {
    User.findByIdAndUpdate = previousFindByIdAndUpdate;
  }
});

test("socket authentication rejects a connection without a token", async () => {
  let connectionError;

  await socketAuth({ handshake: { auth: {} }, data: {} }, (error) => {
    connectionError = error;
  });

  assert.equal(connectionError.data.code, "AUTH_REQUIRED");
});

test("socket authentication accepts a valid login token", async () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousFindById = User.findById;
  const secret = randomBytes(32).toString("hex");
  const userId = new mongoose.Types.ObjectId().toString();
  const socket = {
    handshake: {
      auth: {
        token: jwt.sign(
          { sub: userId, tokenVersion: 0 },
          secret,
          { algorithm: "HS256" },
        ),
      },
    },
    data: {},
  };
  process.env.JWT_SECRET = secret;
  User.findById = () => ({
    select() {
      return {
        async lean() {
          return {
            _id: new mongoose.Types.ObjectId(userId),
            displayName: "Ada Lovelace",
            email: "ada@example.com",
            userType: "Registered",
            isActive: true,
            tokenVersion: 0,
          };
        },
      };
    },
  });

  try {
    let connectionError;
    await socketAuth(socket, (error) => {
      connectionError = error;
    });

    assert.equal(connectionError, undefined);
    assert.deepEqual(socket.data.user, {
      id: userId,
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      userType: "Registered",
    });
  } finally {
    User.findById = previousFindById;
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  }
});
