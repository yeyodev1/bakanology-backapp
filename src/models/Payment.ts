import { Schema, model, Document, Types } from "mongoose";

export interface IPayment extends Document {
  user: Types.ObjectId;
  plan: "annual" | "lifetime";
  amount: number;
  currency: "USD";
  status: "pending" | "approved" | "failed" | "canceled";
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  clientTransactionId: string;
  isNewUser: boolean;
  plainPassword: string | null;
  origin: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    plan: { type: String, enum: ["annual", "lifetime"], default: "annual" },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ["USD"], default: "USD" },
    status: {
      type: String,
      enum: ["pending", "approved", "failed", "canceled"],
      default: "pending",
    },
    stripeSessionId: { type: String, default: null },
    stripePaymentIntentId: { type: String, default: null },
    clientTransactionId: { type: String, required: true, unique: true },
    isNewUser: { type: Boolean, default: false },
    plainPassword: { type: String, default: null },
    origin: { type: String, default: null },
  },
  { timestamps: true },
);

export const Payment = model<IPayment>("Payment", paymentSchema);
