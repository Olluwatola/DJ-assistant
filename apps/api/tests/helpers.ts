import jwt from "jsonwebtoken";
import mongoose from "mongoose";

export const TEST_SECRET = "test_jwt_secret_32_chars_minimum!!";

export const TEST_USER_ID = new mongoose.Types.ObjectId().toHexString();
export const OTHER_USER_ID = new mongoose.Types.ObjectId().toHexString();

export function makeToken(userId = TEST_USER_ID): string {
  return jwt.sign({ userId, email: "test@example.com" }, TEST_SECRET, { expiresIn: "1h" });
}

export function makeObjectId(): string {
  return new mongoose.Types.ObjectId().toHexString();
}

/** Mongoose-style doc: plain data + .save() mock */
export function makeDoc<T extends object>(data: T): T & { save: jest.Mock } {
  return { ...data, save: jest.fn().mockResolvedValue(undefined) };
}

/** Mongoose query stub: { lean() } */
export function leanQuery<T>(value: T) {
  return { lean: jest.fn().mockResolvedValue(value) };
}

/** Mongoose query stub: { sort() → { lean() } } */
export function sortLeanQuery<T>(value: T) {
  return { sort: jest.fn().mockReturnValue(leanQuery(value)) };
}

/** Mongoose query stub: { sort() → { lean() } } then further chained find */
export function findSortLean<T>(value: T[]) {
  return sortLeanQuery(value);
}
