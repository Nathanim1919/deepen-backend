import mongoose, { Schema } from "mongoose";

interface Waitlist {
  email: string;
  createdAt: Date;
  updatedAt: Date;
  emailSent: boolean;
}

const WaitlistSchema = new Schema<Waitlist>(
  {
    email: {
      type: String,
      required: true,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Waitlist = mongoose.model("Waitlist", WaitlistSchema);
export default Waitlist;
