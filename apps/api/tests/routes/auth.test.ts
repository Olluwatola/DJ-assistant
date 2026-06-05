import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { app } from "../../src/app";
import { TEST_SECRET, TEST_USER_ID } from "../helpers";

// --- Module mocks (hoisted before imports by Jest) ---
jest.mock("../../src/models/User");
jest.mock("bcrypt");

import { User } from "../../src/models/User";
import bcrypt from "bcrypt";

const mockUser = {
  _id: new mongoose.Types.ObjectId(TEST_USER_ID),
  email: "test@example.com",
  hashedPassword: "$2b$10$hashedpw",
  createdAt: new Date("2024-01-01"),
};

describe("POST /api/auth/register", () => {
  it("creates a user and returns 201 with token + user shape", async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue("$2b$10$hashed");
    (User.create as jest.Mock).mockResolvedValue(mockUser);

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "test@example.com", password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe("test@example.com");
    expect(res.body.user._id).toBeDefined();
    expect(res.body.user.createdAt).toBeDefined();
    // Password must never appear in the response
    expect(JSON.stringify(res.body)).not.toContain("password123");
  });

  it("returns a valid JWT signed with JWT_SECRET", async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue("$2b$10$hashed");
    (User.create as jest.Mock).mockResolvedValue(mockUser);

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "test@example.com", password: "password123" });

    const payload = jwt.verify(res.body.token, TEST_SECRET) as { userId: string };
    expect(payload.userId).toBe(TEST_USER_ID);
  });

  it("returns 409 when email is already registered", async () => {
    (User.findOne as jest.Mock).mockResolvedValue(mockUser);

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "test@example.com", password: "password123" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it("returns 400 for an invalid email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email", password: "password123" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when password is shorter than 8 chars", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "test@example.com", password: "short" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when body is missing required fields", async () => {
    const res = await request(app).post("/api/auth/register").send({});
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("returns 200 with token and user on valid credentials", async () => {
    (User.findOne as jest.Mock).mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe("test@example.com");
  });

  it("returns a valid JWT on login", async () => {
    (User.findOne as jest.Mock).mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "password123" });

    const payload = jwt.verify(res.body.token, TEST_SECRET) as { userId: string };
    expect(payload.userId).toBe(TEST_USER_ID);
  });

  it("returns 401 when email is not found", async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "noone@example.com", password: "password123" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it("returns 401 when password is incorrect", async () => {
    (User.findOne as jest.Mock).mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "wrongpass" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it("returns 400 for an invalid email format", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "not-email", password: "password123" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when body is empty", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
  });
});
