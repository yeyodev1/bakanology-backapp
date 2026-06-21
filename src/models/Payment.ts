import { Schema, model, Document, Types } from "mongoose";

export interface IPayment extends Document {
  user: Types.ObjectId;
  plan: "monthly" | "annual";
  amount: number;
  currency: "USD";
  status: "pending" | "approved" | "failed" | "canceled";
  payphoneTransactionId: number | null;
  clientTransactionId: string;
  payphoneResponse: unknown;
  isNewUser: boolean;
  plainPassword: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    plan: { type: String, enum: ["monthly", "annual"], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ["USD"], default: "USD" },
    status: {
      type: String,
      enum: ["pending", "approved", "failed", "canceled"],
      default: "pending",
    },
    payphoneTransactionId: { type: Number, default: null },
    clientTransactionId: { type: String, required: true, unique: true },
    payphoneResponse: { type: Schema.Types.Mixed, default: null },
    isNewUser: { type: Boolean, default: false },
    plainPassword: { type: String, default: null },
  },
  { timestamps: true },
);

export const Payment = model<IPayment>("Payment", paymentSchema);
