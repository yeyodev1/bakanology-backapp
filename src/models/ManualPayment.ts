import { Schema, model, Document, Types } from "mongoose";

export interface IManualPayment extends Document {
  user: Types.ObjectId;
  plan: "monthly" | "annual";
  amount: number;
  currency: "USD";
  status: "pending" | "approved";
  receiptImage: string;
  receiptPublicId: string;
  notes: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const manualPaymentSchema = new Schema<IManualPayment>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    plan: { type: String, enum: ["monthly", "annual"], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ["USD"], default: "USD" },
    status: { type: String, enum: ["pending", "approved"], default: "pending" },
    receiptImage: { type: String, required: true },
    receiptPublicId: { type: String, required: true },
    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

export const ManualPayment = model<IManualPayment>(
  "ManualPayment",
  manualPaymentSchema,
);
