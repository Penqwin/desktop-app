import { Polar } from "@polar-sh/sdk";

// Lazy getter — avoids crashing at module load time if env var is missing
const getPolarClient = () => {
  const token = process.env.POLAR_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "POLAR_ACCESS_TOKEN is not set. Please add it to your environment variables.",
    );
  }
  return new Polar({
    accessToken: token,
    server:
      process.env.NEXT_PUBLIC_APP_ENV === "production"
        ? "production"
        : "sandbox",
  });
};

export const getPolarCheckoutUrl = async (
  productId: string,
  organizationId: string,
) => {
  const polar = getPolarClient();
  const checkout = await polar.checkouts.create({
    products: [productId],
    successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?success=true&checkout_id={CHECKOUT_ID}`,
    metadata: {
      organizationId,
      organization_id: organizationId,
    },
  });
  return checkout.url;
};
