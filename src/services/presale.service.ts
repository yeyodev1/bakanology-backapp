export function getStatus() {
  const deadline = new Date(process.env.PRESALE_DEADLINE as string);
  const now = new Date();

  return {
    deadline: deadline.toISOString(),
    isActive: now < deadline,
    annualPrice: Number(process.env.ANNUAL_PRICE),
    monthlyPrice: Number(process.env.MONTHLY_PRICE),
    whatsappNumber: process.env.WHATSAPP_NUMBER,
  };
}
