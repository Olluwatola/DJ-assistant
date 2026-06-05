import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { requireAuth } from "../../src/middleware/requireAuth";
import { TEST_SECRET, TEST_USER_ID } from "../helpers";

function makeReqRes(authHeader?: string) {
  const req = { headers: { authorization: authHeader } } as unknown as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn();
  return { req, res, next };
}

describe("requireAuth middleware", () => {
  it("returns 401 when Authorization header is absent", () => {
    const { req, res, next } = makeReqRes();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when header does not start with 'Bearer '", () => {
    const { req, res, next } = makeReqRes("Basic dXNlcjpwYXNz");
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for a malformed token", () => {
    const { req, res, next } = makeReqRes("Bearer not.a.valid.jwt");
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for a token signed with the wrong secret", () => {
    const token = jwt.sign({ userId: TEST_USER_ID }, "wrong_secret");
    const { req, res, next } = makeReqRes(`Bearer ${token}`);
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for an expired token", () => {
    const token = jwt.sign({ userId: TEST_USER_ID }, TEST_SECRET, { expiresIn: -1 });
    const { req, res, next } = makeReqRes(`Bearer ${token}`);
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() and attaches userId for a valid token", () => {
    const token = jwt.sign({ userId: TEST_USER_ID }, TEST_SECRET, { expiresIn: "1h" });
    const { req, res, next } = makeReqRes(`Bearer ${token}`);
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).userId).toBe(TEST_USER_ID);
    expect(res.status).not.toHaveBeenCalled();
  });
});
