import { Request, Response } from "express";
import { ZodError, z } from "zod";
import { errorHandler } from "../../src/middleware/errorHandler";

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

const req = {} as Request;
const next = jest.fn();

describe("errorHandler middleware", () => {
  it("returns 400 with field errors for a ZodError", () => {
    const res = makeRes();
    let zodErr: ZodError;
    try {
      z.object({ email: z.string().email(), age: z.number() }).parse({ email: "bad", age: "nope" });
    } catch (err) {
      zodErr = err as ZodError;
    }
    errorHandler(zodErr!, req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error).toBe("Validation error");
    expect(body.issues).toBeDefined();
  });

  it("returns 500 with the error message for a generic Error", () => {
    const res = makeRes();
    errorHandler(new Error("something broke"), req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect((res.json as jest.Mock).mock.calls[0][0]).toEqual({ error: "something broke" });
  });

  it("returns 500 with a fallback message for a non-Error thrown value", () => {
    const res = makeRes();
    errorHandler("a plain string error", req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect((res.json as jest.Mock).mock.calls[0][0]).toEqual({ error: "Internal server error" });
  });
});
