import request from "supertest";
import mongoose from "mongoose";
import { app } from "../../src/app";
import { makeToken, makeObjectId, TEST_USER_ID, OTHER_USER_ID } from "../helpers";

jest.mock("../../src/models/PlaylistDesignation");

import { PlaylistDesignation } from "../../src/models/PlaylistDesignation";

const TOKEN = makeToken(TEST_USER_ID);

const DES_ID = makeObjectId();

const mockDesignation = {
  _id: { toString: () => DES_ID },
  userId: { toString: () => TEST_USER_ID },
  platform: "spotify",
  platformPlaylistId: "pl_abc",
  playlistName: "Energetic",
  type: "base",
};

describe("GET /api/designations", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/designations");
    expect(res.status).toBe(401);
  });

  it("returns empty array when user has no designations", async () => {
    (PlaylistDesignation.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    const res = await request(app)
      .get("/api/designations")
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns all designations belonging to the current user", async () => {
    (PlaylistDesignation.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([mockDesignation]),
    });

    const res = await request(app)
      .get("/api/designations")
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].platformPlaylistId).toBe("pl_abc");
    expect(res.body[0].type).toBe("base");
  });
});

describe("POST /api/designations", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).post("/api/designations").send({
      platform: "spotify",
      platformPlaylistId: "pl_abc",
      playlistName: "Energetic",
      type: "base",
    });
    expect(res.status).toBe(401);
  });

  it("upserts and returns 201 with the designation", async () => {
    (PlaylistDesignation.findOneAndUpdate as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockDesignation),
    });

    const res = await request(app)
      .post("/api/designations")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        platform: "spotify",
        platformPlaylistId: "pl_abc",
        playlistName: "Energetic",
        type: "base",
      });

    expect(res.status).toBe(201);
    expect(res.body.platform).toBe("spotify");
    expect(res.body.type).toBe("base");
    expect(res.body.platformPlaylistId).toBe("pl_abc");
  });

  it("accepts song_box as a valid type", async () => {
    const songBoxDes = { ...mockDesignation, type: "song_box" };
    (PlaylistDesignation.findOneAndUpdate as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(songBoxDes),
    });

    const res = await request(app)
      .post("/api/designations")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        platform: "spotify",
        platformPlaylistId: "pl_xyz",
        playlistName: "Afrobeats",
        type: "song_box",
      });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("song_box");
  });

  it("returns 400 for an invalid type value", async () => {
    const res = await request(app)
      .post("/api/designations")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        platform: "spotify",
        platformPlaylistId: "pl_abc",
        playlistName: "Energetic",
        type: "invalid_type",
      });

    expect(res.status).toBe(400);
  });

  it("returns 400 when platform is missing", async () => {
    const res = await request(app)
      .post("/api/designations")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ platformPlaylistId: "pl_abc", playlistName: "E", type: "base" });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/designations/:id", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).delete(`/api/designations/${DES_ID}`);
    expect(res.status).toBe(401);
  });

  it("returns 404 when the designation does not exist", async () => {
    (PlaylistDesignation.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const res = await request(app)
      .delete(`/api/designations/${DES_ID}`)
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it("returns 403 when the designation belongs to another user", async () => {
    const otherOwned = { ...mockDesignation, userId: { toString: () => OTHER_USER_ID } };
    (PlaylistDesignation.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(otherOwned),
    });

    const res = await request(app)
      .delete(`/api/designations/${DES_ID}`)
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(403);
  });

  it("deletes the designation and returns success when owner", async () => {
    (PlaylistDesignation.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockDesignation),
    });
    (PlaylistDesignation.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 });

    const res = await request(app)
      .delete(`/api/designations/${DES_ID}`)
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(PlaylistDesignation.deleteOne).toHaveBeenCalledWith({ _id: DES_ID });
  });
});
