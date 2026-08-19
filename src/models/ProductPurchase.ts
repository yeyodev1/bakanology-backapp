import { Schema, model, Document, Types } from "mongoose";

export type ProductSlug = "setter_automatico";
export type ProductType = "ebook";

export interface IProductPurchase extends Document {
  user: Types.ObjectId;
  productSlug: ProductSlug;
  productName: string;
  productType: ProductType;
  productDescription: string;
  amount: number;
  currency: "USD";
  status: "pending" | "approved" | "failed" | "canceled";
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  clientTransactionId: string;
  isNewUser: boolean;
  plainPassword: string | null;
  origin: string | null;
  fulfilledAt: Date | null;
  emailSentAt: Date | null;
  metaEventSentAt: Date | null;
  credentialsViewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const productPurchaseSchema = new Schema<IProductPurchase>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    productSlug: { type: String, enum: ["setter_automatico"], required: true },
    productName: { type: String, required: true },
    productType: { type: String, enum: ["ebook"], required: true },
    productDescription: { type: String, required: true },
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
    fulfilledAt: { type: Date, default: null },
    emailSentAt: { type: Date, default: null },
    metaEventSentAt: { type: Date, default: null },
    credentialsViewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

productPurchaseSchema.index(
  { user: 1, productSlug: 1 },
  { unique: true, partialFilterExpression: { status: "approved" } },
);

export const ProductPurchase = model<IProductPurchase>(
  "ProductPurchase",
  productPurchaseSchema,
);
