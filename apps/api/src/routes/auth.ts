import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { RegisterBodySchema, LoginBodySchema } from "@dj-assistant/types";
import { User } from "../models/User";
import { config } from "../config";

const router = Router();

router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = RegisterBodySchema.parse(req.body);

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email, hashedPassword });

    const token = jwt.sign({ userId: user._id.toString(), email }, config.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({
      token,
      user: { _id: user._id.toString(), email: user.email, createdAt: user.createdAt.toISOString() },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = LoginBodySchema.parse(req.body);

    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.hashedPassword);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = jwt.sign({ userId: user._id.toString(), email }, config.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      token,
      user: { _id: user._id.toString(), email: user.email, createdAt: user.createdAt.toISOString() },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
