import mongoose, { Schema, Document, Types } from "mongoose";

export interface ISet extends Document {
  userId: Types.ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const SetSchema = new Schema<ISet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

SetSchema.index({ userId: 1, updatedAt: -1 });

export const Set = mongoose.model<ISet>("Set", SetSchema);
