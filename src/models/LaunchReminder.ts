import { Schema, model, Document, Types } from "mongoose";

export interface ILaunchReminder extends Document {
  email: string;
  user: Types.ObjectId | null;
  createdAt: Date;
  notified: boolean;
}

const launchReminderSchema = new Schema<ILaunchReminder>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
    notified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const LaunchReminder = model<ILaunchReminder>(
  "LaunchReminder",
  launchReminderSchema,
);
