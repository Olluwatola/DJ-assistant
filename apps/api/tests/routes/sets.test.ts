import request from "supertest";
import mongoose from "mongoose";
import { app } from "../../src/app";
import { makeToken, makeObjectId, TEST_USER_ID, OTHER_USER_ID, makeDoc } from "../helpers";

jest.mock("../../src/models/Set");
jest.mock("../../src/models/SetTrack");

import { Set as SetModel } from "../../src/models/Set";
import { SetTrack } from "../../src/models/SetTrack";

const TOKEN = makeToken(TEST_USER_ID);
const SET_ID = makeObjectId();
const now = new Date("2024-06-01T12:00:00Z");

const mockSetDoc = makeDoc({
  _id: { toString: () => SET_ID },
  userId: { toString: () => TEST_USER_ID },
  name: "Friday Night",
  createdAt: now,
  updatedAt: now,
});

const mockSetLean = {
  _id: { toString: () => SET_ID },
  userId: { toString: () => TEST_USER_ID },
  name: "Friday Night",
  createdAt: now,
  updatedAt: now,
};

const mockTrack = {
  position: 0,
  platform: "spotify",
  platformTrackId: "track_001",
  snapshotTitle: "Song A",
  snapshotArtist: "Artist A",
};

// ── GET /api/sets ──────────────────────────────────────────────────────────

describe("GET /api/sets", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/sets");
    expect(res.status).toBe(401);
  });

  it("returns empty array when user has no sets", async () => {
    (SetModel.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    });

    const res = await request(app)
      .get("/api/sets")
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns sets with trackCount sorted by updatedAt DESC", async () => {
    (SetModel.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([mockSetLean]),
      }),
    });
    (SetTrack.countDocuments as jest.Mock).mockResolvedValue(3);

    const res = await request(app)
      .get("/api/sets")
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Friday Night");
    expect(res.body[0].trackCount).toBe(3);
    expect(res.body[0]._id).toBe(SET_ID);
  });
});

// ── POST /api/sets ─────────────────────────────────────────────────────────

describe("POST /api/sets", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).post("/api/sets").send({ name: "New" });
    expect(res.status).toBe(401);
  });

  it("creates a set and returns 201", async () => {
    (SetModel.create as jest.Mock).mockResolvedValue(mockSetDoc);

    const res = await request(app)
      .post("/api/sets")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ name: "Friday Night" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Friday Night");
    expect(res.body._id).toBe(SET_ID);
    expect(res.body.tracks).toEqual([]);
  });

  it("returns 400 for an empty name", async () => {
    const res = await request(app)
      .post("/api/sets")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ name: "" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/api/sets")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ── GET /api/sets/:id ──────────────────────────────────────────────────────

describe("GET /api/sets/:id", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get(`/api/sets/${SET_ID}`);
    expect(res.status).toBe(401);
  });

  it("returns 404 when set does not exist", async () => {
    (SetModel.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const res = await request(app)
      .get(`/api/sets/${SET_ID}`)
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(404);
  });

  it("returns 403 when set belongs to another user", async () => {
    const otherSet = { ...mockSetLean, userId: { toString: () => OTHER_USER_ID } };
    (SetModel.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(otherSet),
    });

    const res = await request(app)
      .get(`/api/sets/${SET_ID}`)
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(403);
  });

  it("returns the set with its tracks when owner", async () => {
    (SetModel.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockSetLean),
    });
    (SetTrack.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([mockTrack]) }),
    });

    const res = await request(app)
      .get(`/api/sets/${SET_ID}`)
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Friday Night");
    expect(res.body.tracks).toHaveLength(1);
    expect(res.body.tracks[0].snapshotTitle).toBe("Song A");
  });
});

// ── PUT /api/sets/:id ──────────────────────────────────────────────────────

describe("PUT /api/sets/:id", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).put(`/api/sets/${SET_ID}`).send({ name: "Renamed" });
    expect(res.status).toBe(401);
  });

  it("returns 404 when set does not exist", async () => {
    (SetModel.findById as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/sets/${SET_ID}`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ name: "Renamed" });

    expect(res.status).toBe(404);
  });

  it("returns 403 when set belongs to another user", async () => {
    const otherDoc = makeDoc({ ...mockSetLean, userId: { toString: () => OTHER_USER_ID } });
    (SetModel.findById as jest.Mock).mockResolvedValue(otherDoc);

    const res = await request(app)
      .put(`/api/sets/${SET_ID}`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ name: "Renamed" });

    expect(res.status).toBe(403);
  });

  it("renames the set and returns the updated name", async () => {
    const doc = makeDoc({ ...mockSetDoc });
    (SetModel.findById as jest.Mock).mockResolvedValue(doc);

    const res = await request(app)
      .put(`/api/sets/${SET_ID}`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ name: "Renamed Set" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Renamed Set");
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for an empty name", async () => {
    const res = await request(app)
      .put(`/api/sets/${SET_ID}`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ name: "" });

    expect(res.status).toBe(400);
  });
});

// ── PATCH /api/sets/:id/tracks ─────────────────────────────────────────────

describe("PATCH /api/sets/:id/tracks", () => {
  const validTracks = [
    { platform: "spotify", platformTrackId: "t1", snapshotTitle: "Song A", snapshotArtist: "Artist A" },
    { platform: "spotify", platformTrackId: "t2", snapshotTitle: "Song B", snapshotArtist: "Artist B" },
  ];

  it("returns 401 without a token", async () => {
    const res = await request(app)
      .patch(`/api/sets/${SET_ID}/tracks`)
      .send({ tracks: validTracks });
    expect(res.status).toBe(401);
  });

  it("returns 404 when set does not exist", async () => {
    (SetModel.findById as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .patch(`/api/sets/${SET_ID}/tracks`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ tracks: validTracks });

    expect(res.status).toBe(404);
  });

  it("returns 403 when set belongs to another user", async () => {
    const otherDoc = makeDoc({ ...mockSetLean, userId: { toString: () => OTHER_USER_ID } });
    (SetModel.findById as jest.Mock).mockResolvedValue(otherDoc);

    const res = await request(app)
      .patch(`/api/sets/${SET_ID}/tracks`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ tracks: validTracks });

    expect(res.status).toBe(403);
  });

  it("replaces tracks, saves, and returns trackCount", async () => {
    const doc = makeDoc({ ...mockSetDoc });
    (SetModel.findById as jest.Mock).mockResolvedValue(doc);
    (SetTrack.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 1 });
    (SetTrack.insertMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app)
      .patch(`/api/sets/${SET_ID}/tracks`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ tracks: validTracks });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.trackCount).toBe(2);
    expect(SetTrack.deleteMany).toHaveBeenCalledWith({ setId: doc._id });
    expect(SetTrack.insertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ position: 0, platformTrackId: "t1" }),
        expect.objectContaining({ position: 1, platformTrackId: "t2" }),
      ])
    );
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  it("clears tracks when an empty array is sent", async () => {
    const doc = makeDoc({ ...mockSetDoc });
    (SetModel.findById as jest.Mock).mockResolvedValue(doc);
    (SetTrack.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 5 });

    const res = await request(app)
      .patch(`/api/sets/${SET_ID}/tracks`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ tracks: [] });

    expect(res.status).toBe(200);
    expect(res.body.trackCount).toBe(0);
    expect(SetTrack.insertMany).not.toHaveBeenCalled();
  });

  it("returns 400 when tracks field is missing", async () => {
    const res = await request(app)
      .patch(`/api/sets/${SET_ID}/tracks`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns 400 when a track is missing snapshotTitle", async () => {
    const res = await request(app)
      .patch(`/api/sets/${SET_ID}/tracks`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        tracks: [{ platform: "spotify", platformTrackId: "t1", snapshotArtist: "A" }],
      });

    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/sets/:id ───────────────────────────────────────────────────

describe("DELETE /api/sets/:id", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).delete(`/api/sets/${SET_ID}`);
    expect(res.status).toBe(401);
  });

  it("returns 404 when set does not exist", async () => {
    (SetModel.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const res = await request(app)
      .delete(`/api/sets/${SET_ID}`)
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(404);
  });

  it("returns 403 when set belongs to another user", async () => {
    const otherSet = { ...mockSetLean, userId: { toString: () => OTHER_USER_ID } };
    (SetModel.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(otherSet),
    });

    const res = await request(app)
      .delete(`/api/sets/${SET_ID}`)
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(403);
  });

  it("deletes the set and its tracks, returns success", async () => {
    (SetModel.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockSetLean),
    });
    (SetTrack.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 2 });
    (SetModel.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 });

    const res = await request(app)
      .delete(`/api/sets/${SET_ID}`)
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(SetTrack.deleteMany).toHaveBeenCalled();
    expect(SetModel.deleteOne).toHaveBeenCalled();
  });
});
