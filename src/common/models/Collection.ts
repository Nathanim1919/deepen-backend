import mongoose, { Document } from "mongoose";

export interface ICollection extends Document {
  user: mongoose.Types.ObjectId;
  name: string;
  captures?: mongoose.Types.ObjectId[];
  parentCollection?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CollectionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true },
    captures: [{ type: mongoose.Schema.Types.ObjectId, ref: "Capture" }],
    parentCollection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Collection",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Collection = mongoose.model("Collection", CollectionSchema);
export default Collection;
