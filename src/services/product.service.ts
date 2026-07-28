import crypto from "crypto";
import Stripe from "stripe";
import { cloudinary } from "../config/cloudinary";
import { CustomError } from "../errors/customError.error";
import {
  sendProductConfirmationEmail,
  sendProductWelcomeEmail,
} from "../helpers/email.helper";
import { hashPassword } from "../helpers/password.helper";
import { Payment } from "../models/Payment";
import {
  ProductPurchase,
  type IProductPurchase,
  type ProductSlug,
} from "../models/ProductPurchase";
import { User, type IUser } from "../models/User";
import { sendMetaEvent } from "./metaConversions.service";

const PRODUCTION_ACCOUNT_URL = "https://bakanology.com/login?redirect=/app/productos-adquiridos";
const LOCAL_ACCOUNT_URL = "http://localhost:5174/login?redirect=/app/productos-adquiridos";
const SETTER_AUTOMATICO_PUBLIC_ID = "bakanology/productos/playbook-setter-automatico-marketing-digital.pdf";
const PRODUCT_CATALOG: Record<ProductSlug, {
  name: string;
  type: "ebook";
  description: string;
}> = {
  setter_automatico: {
    name: "El Playbook del Setter Automático",
    type: "ebook",
    description: "Manual operativo para implementar prospección, triaje, seguimiento y control comercial.",
  },
};

function getStripeKey(): string {
  const key = process.env.NODE_ENV === "production"
    ? process.env.STRIPE_SECRET_KEY
    : process.env.STRIPE_TEST_SECRET_KEY;
  if (!key) throw new Error("Stripe secret key is not configured");
  return key;
}

function readProductPrice(): number {
  const configured = Number(process.env.SETTER_AUTOMATICO_PRICE);
  if (!Number.isFinite(configured) || configured <= 0 || configured > 10_000) return 17;
  return Math.round(configured * 100) / 100;
}

function resolveReturnOrigin(candidate?: string): string {
  const fallback = process.env.FRONTEND_URL || "http://localhost:5173";
  if (!candidate) return fallback;
  try {
    const origin = new URL(candidate).origin;
    const allowed = new Set([
      fallback,
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
      "https://testing-storybrand-frontend.bakano.ec",
      "https://bakanology-funnel.vercel.app",
      "https://bakanology-funnel.netlify.app",
      "https://bakanology-ebook-setterautomatico.vercel.app",
      "https://bakanology-ebook-setterautomatico.netlify.app",
      "https://academy.bakano.ec",
      "https://bakanology.bakano.ec",
      "https://bakanology.com",
      "https://www.bakanology.com",
    ]);
    return allowed.has(origin) ? origin : fallback;
  } catch {
    return fallback;
  }
}

function resolveAccountUrl(origin?: string | null): string {
  if (!origin) return PRODUCTION_ACCOUNT_URL;
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1"
      ? LOCAL_ACCOUNT_URL
      : PRODUCTION_ACCOUNT_URL;
  } catch {
    return PRODUCTION_ACCOUNT_URL;
  }
}

function normalizeProduct(value: unknown): ProductSlug {
  if (value === "setter_automatico") return value;
  throw new CustomError("Invalid product", 400);
}

function generatePassword() {
  return crypto.randomBytes(8).toString("hex");
}

function stripeId(value: string | { id: string } | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function productPayload(slug: ProductSlug) {
  const product = PRODUCT_CATALOG[slug];
  return {
    slug,
    name: product.name,
    type: product.type,
    description: product.description,
  };
}

const stripe = new Stripe(getStripeKey());

async function findOrCreateBuyer(input: { email: string; name: string; lastName: string }) {
  const normalizedEmail = input.email.toLowerCase().trim();
  let user = await User.findOne({ email: normalizedEmail });
  if (user) {
    const recoverableCheckout = await ProductPurchase.findOne({
      user: user._id,
      status: { $in: ["pending", "failed", "canceled"] },
      isNewUser: true,
      plainPassword: { $nin: [null, ""] },
    }).sort({ createdAt: -1 });
    if (recoverableCheckout) {
      return { user, isNew: true, plainPassword: recoverableCheckout.plainPassword, lockAcquired: false };
    }
    return { user, isNew: false, plainPassword: null, lockAcquired: false };
  }

  const plainPassword = generatePassword();
  try {
    user = await User.create({
      name: input.name.trim(),
      lastName: input.lastName.trim(),
      email: normalizedEmail,
      password: await hashPassword(plainPassword),
      isVerified: true,
      verificationToken: null,
      verificationTokenExpires: null,
      subscriptionStatus: "none",
      accessUntil: null,
      foundingMember: false,
      entitlements: [],
      checkoutLockUntil: new Date(Date.now() + 60_000),
      createdByCheckout: true,
    });
    return { user, isNew: true, plainPassword, lockAcquired: true };
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    user = await User.findOne({ email: normalizedEmail });
    if (!user) throw error;
    return { user, isNew: false, plainPassword: null, lockAcquired: false };
  }
}

async function acquireCheckoutLock(userId: string) {
  const now = new Date();
  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { checkoutLockUntil: null },
        { checkoutLockUntil: { $exists: false } },
        { checkoutLockUntil: { $lte: now } },
      ],
    },
    { checkoutLockUntil: new Date(now.getTime() + 60_000) },
    { new: true },
  );
  if (!user) throw new CustomError("Another checkout is already being prepared for this account", 409);
  return user;
}

async function cancelPendingProductCheckouts(userId: string, productSlug: ProductSlug) {
  const pendingPurchases = await ProductPurchase.find({ user: userId, productSlug, status: "pending" });
  for (const purchase of pendingPurchases) {
    if (purchase.stripeSessionId) {
      const session = await stripe.checkout.sessions.retrieve(purchase.stripeSessionId);
      if (session.status === "open") await stripe.checkout.sessions.expire(session.id);
      if (session.status === "complete") {
        throw new CustomError("A purchase for this product is already being completed", 409);
      }
    }
    purchase.status = "canceled";
    await purchase.save();
  }
}

export async function createProductCheckoutSession(input: {
  product: unknown;
  email: string;
  name: string;
  lastName: string;
  origin?: string;
}) {
  const productSlug = normalizeProduct(input.product);
  const normalizedEmail = input.email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new CustomError("Invalid email address", 400);
  }

  const guest = await findOrCreateBuyer(input);
  const userId = guest.user._id.toString();
  const lockedUser = guest.lockAcquired ? guest.user : await acquireCheckoutLock(userId);
  try {
    const alreadyPurchased = await ProductPurchase.exists({
      user: userId,
      productSlug,
      status: "approved",
    });
    if (alreadyPurchased) throw new CustomError("Product already purchased", 409);
    await cancelPendingProductCheckouts(userId, productSlug);

    let isNew = guest.isNew;
    let plainPassword = guest.plainPassword;
    if (!isNew && lockedUser.createdByCheckout && lockedUser.subscriptionStatus === "none") {
      const [hasPaymentHistory, hasProductHistory] = await Promise.all([
        Payment.exists({ user: userId }),
        ProductPurchase.exists({ user: userId }),
      ]);
      if (!hasPaymentHistory && !hasProductHistory) {
        plainPassword = generatePassword();
        lockedUser.password = await hashPassword(plainPassword);
        lockedUser.isVerified = true;
        await lockedUser.save();
        isNew = true;
      }
    }

    const product = PRODUCT_CATALOG[productSlug];
    const amount = readProductPrice();
    const clientTransactionId = `product-${userId}-${Date.now()}`;
    const origin = resolveReturnOrigin(input.origin);
    const purchase = await ProductPurchase.create({
      user: userId,
      productSlug,
      productName: product.name,
      productType: product.type,
      productDescription: product.description,
      amount,
      currency: "USD",
      clientTransactionId,
      status: "pending",
      isNewUser: isNew,
      plainPassword,
      origin,
    });
    if (plainPassword) {
      await ProductPurchase.updateMany(
        { user: userId, _id: { $ne: purchase._id }, status: { $in: ["failed", "canceled"] } },
        { plainPassword: null },
      );
    }

    const metadata = {
      purchaseKind: "product",
      product: productSlug,
      clientTransactionId,
      userId,
    };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: product.name,
            description: product.description,
            metadata: { purchaseKind: "product", product: productSlug },
          },
        },
        quantity: 1,
      }],
      client_reference_id: clientTransactionId,
      customer_email: normalizedEmail,
      customer_creation: "always",
      metadata,
      payment_intent_data: { metadata },
      success_url: `${origin}/pay-response?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#oferta`,
    });
    await ProductPurchase.updateOne({ clientTransactionId }, { stripeSessionId: session.id });
    return { url: session.url, sessionId: session.id, clientTransactionId };
  } finally {
    await User.updateOne({ _id: userId }, { checkoutLockUntil: null });
  }
}

async function sendPurchaseEmail(purchase: IProductPurchase, user: IUser) {
  const accountUrl = resolveAccountUrl(purchase.origin);
  if (purchase.isNewUser && purchase.plainPassword) {
    await sendProductWelcomeEmail(user.email, user.name, purchase.plainPassword, accountUrl);
  } else {
    await sendProductConfirmationEmail(user.email, user.name, accountUrl);
  }
}

export async function resendProductPurchaseEmail(sessionId: string) {
  const purchase = await ProductPurchase.findOne({ stripeSessionId: sessionId });
  if (!purchase) throw new CustomError("Product purchase not found", 404);
  if (purchase.status !== "approved") throw new CustomError("Product purchase not approved yet", 400);
  const user = await User.findById(purchase.user);
  if (!user) throw new CustomError("User not found", 404);

  await sendPurchaseEmail(purchase, user);
  purchase.emailSentAt = new Date();
  if (purchase.credentialsViewedAt) purchase.plainPassword = null;
  await purchase.save();
  if (purchase.credentialsViewedAt) {
    await ProductPurchase.updateMany({ user: purchase.user, isNewUser: true }, { plainPassword: null });
  }
  return { resent: true, email: user.email };
}

export async function approveProductCheckout(
  purchase: IProductPurchase,
  session: Stripe.Checkout.Session,
  requireEmail = false,
) {
  const user = await User.findById(purchase.user);
  if (!user) throw new Error("Product purchase user is missing");
  let approved = await ProductPurchase.findByIdAndUpdate(
    purchase._id,
    {
      status: "approved",
      stripeSessionId: session.id,
      stripePaymentIntentId: stripeId(session.payment_intent),
    },
    { new: true },
  );
  if (!approved) throw new Error("Product purchase record is missing");

  if (!approved.fulfilledAt) {
    approved = await ProductPurchase.findOneAndUpdate(
      { _id: approved._id, fulfilledAt: null },
      { fulfilledAt: new Date() },
      { new: true },
    ) || await ProductPurchase.findById(approved._id);
    if (!approved) throw new Error("Product purchase fulfillment could not be recorded");
  }

  if (!approved.metaEventSentAt) {
    const claimed = await ProductPurchase.findOneAndUpdate(
      { _id: approved._id, metaEventSentAt: null },
      { metaEventSentAt: new Date() },
    );
    if (claimed) {
      try {
        await sendMetaEvent({
          eventName: "Purchase",
          eventId: `purchase_${session.id}`,
          sourceUrl: `${approved.origin || "https://bakanology.com"}/pay-response?session_id=${session.id}`,
          userData: {
            email: user.email,
            firstName: user.name,
            lastName: user.lastName,
            externalId: user._id.toString(),
          },
          customData: {
            currency: approved.currency,
            value: approved.amount,
            content_ids: [approved.productSlug],
            content_type: "product",
          },
        });
      } catch (error) {
        await ProductPurchase.updateOne({ _id: approved._id }, { metaEventSentAt: null });
        console.error("Failed to send product Meta Purchase event:", error);
      }
    }
  }

  if (!approved.emailSentAt) {
    const claimed = await ProductPurchase.findOneAndUpdate(
      { _id: approved._id, emailSentAt: null },
      { emailSentAt: new Date() },
    );
    if (claimed) {
      try {
        await sendPurchaseEmail(approved, user);
      } catch (error) {
        await ProductPurchase.updateOne({ _id: approved._id }, { emailSentAt: null });
        console.error("Failed to send product purchase email:", error);
        if (requireEmail) throw error;
      }
    }
  }
  return user;
}

export async function verifyProductSession(session: Stripe.Checkout.Session) {
  let purchase = await ProductPurchase.findOne({ stripeSessionId: session.id });
  if (!purchase && session.metadata?.clientTransactionId) {
    purchase = await ProductPurchase.findOne({ clientTransactionId: session.metadata.clientTransactionId });
  }
  if (!purchase) throw new CustomError("Product purchase record not found", 404);

  const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
  const user = paid ? await approveProductCheckout(purchase, session) : await User.findById(purchase.user);
  purchase = await ProductPurchase.findById(purchase._id);
  let plainPassword: string | undefined;
  if (paid && purchase?.isNewUser && purchase.plainPassword && !purchase.credentialsViewedAt) {
    const claimed = await ProductPurchase.findOneAndUpdate(
      { _id: purchase._id, credentialsViewedAt: null },
      { credentialsViewedAt: new Date() },
    );
    plainPassword = claimed?.plainPassword || undefined;
    if (claimed?.emailSentAt) {
      await ProductPurchase.updateMany({ user: purchase.user, isNewUser: true }, { plainPassword: null });
    }
  }

  return {
    status: purchase?.status || "pending",
    isNewUser: purchase?.isNewUser || false,
    plainPassword,
    email: user?.email,
    stripePaymentStatus: session.payment_status,
    amount: purchase?.amount,
    currency: purchase?.currency,
    purchaseKind: "product" as const,
    product: purchase ? productPayload(purchase.productSlug) : undefined,
    downloadUrl: purchase ? `/api/products/${purchase.productSlug}/download` : undefined,
  };
}

export async function findPurchaseFromSession(session: Stripe.Checkout.Session) {
  if (session.metadata?.purchaseKind !== "product") return null;
  return session.metadata.clientTransactionId
    ? ProductPurchase.findOne({ clientTransactionId: session.metadata.clientTransactionId })
    : ProductPurchase.findOne({ stripeSessionId: session.id });
}

export async function markProductCheckoutFailed(session: Stripe.Checkout.Session) {
  if (session.metadata?.purchaseKind !== "product") return false;
  await ProductPurchase.updateOne(
    { clientTransactionId: session.metadata.clientTransactionId, status: "pending" },
    { status: "failed" },
  );
  return true;
}

export async function getPurchasedProducts(userId: string) {
  const purchases = await ProductPurchase.find({ user: userId, status: "approved" })
    .sort({ fulfilledAt: -1, createdAt: -1 })
    .lean();
  return {
    products: purchases.map((purchase) => ({
      slug: purchase.productSlug,
      name: purchase.productName,
      type: purchase.productType,
      description: purchase.productDescription,
      purchasedAt: purchase.fulfilledAt || purchase.updatedAt,
      amount: purchase.amount,
      currency: purchase.currency,
    })),
  };
}

export async function getOwnedProductReaderUrl(userId: string, value: unknown) {
  const productSlug = normalizeProduct(value);
  const owned = await ProductPurchase.exists({ user: userId, productSlug, status: "approved" });
  if (!owned) throw new CustomError("Purchased product not found", 404);

  const publicId = process.env.SETTER_AUTOMATICO_CLOUDINARY_PUBLIC_ID?.trim()
    || SETTER_AUTOMATICO_PUBLIC_ID;
  return cloudinary.utils.private_download_url(publicId, "", {
    resource_type: "raw",
    type: "private",
    expires_at: Math.floor(Date.now() / 1000) + 5 * 60,
  });
}
