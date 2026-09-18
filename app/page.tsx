import { getStorefrontProduct } from "./lib/shopify";
import { Storefront } from "./storefront";

export const dynamic = "force-dynamic";

export default async function Home() {
  const product = await getStorefrontProduct();
  return <Storefront product={product} />;
}
