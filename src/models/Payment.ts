import { Schema, model, Document, Types } from "mongoose";

export interface IPayment extends Document {
  user: Types.ObjectId;
  plan: "monthly" | "annual" | "lifetime";
  extras: Array<"crm" | "telegram_vip">;
  amount: number;
  currency: "USD";
  status: "pending" | "approved" | "failed" | "canceled";
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeSubscriptionId: string | null;
  clientTransactionId: string;
  isNewUser: boolean;
  plainPassword: string | null;
  origin: string | null;
  fulfilledAt: Date | null;
  emailSentAt: Date | null;
  credentialsViewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    plan: { type: String, enum: ["monthly", "annual", "lifetime"], default: "annual" },
    extras: {
      type: [String],
      enum: ["crm", "telegram_vip"],
      default: [],
    },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ["USD"], default: "USD" },
    status: {
      type: String,
      enum: ["pending", "approved", "failed", "canceled"],
      default: "pending",
    },
    stripeSessionId: { type: String, default: null },
    stripePaymentIntentId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    clientTransactionId: { type: String, required: true, unique: true },
    isNewUser: { type: Boolean, default: false },
    plainPassword: { type: String, default: null },
    origin: { type: String, default: null },
    fulfilledAt: { type: Date, default: null },
    emailSentAt: { type: Date, default: null },
    credentialsViewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Payment = model<IPayment>("Payment", paymentSchema);
