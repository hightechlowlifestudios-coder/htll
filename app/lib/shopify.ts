export type ShopifyMoney = { amount: string; currencyCode: string };
export type ShopifyImage = { url: string; altText: string | null; width: number | null; height: number | null };
export type ShopifyVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  quantityAvailable: number | null;
  selectedOptions: Array<{ name: string; value: string }>;
  price: ShopifyMoney;
};
export type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  description: string;
  featuredImage: ShopifyImage | null;
  images: ShopifyImage[];
  variants: ShopifyVariant[];
};

type StorefrontResponse<T> = { data?: T; errors?: Array<{ message: string }> };

function config() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN;
  const apiVersion = process.env.SHOPIFY_STOREFRONT_API_VERSION ?? "2026-07";
  if (!domain || !token) throw new Error("Shopify environment variables are not configured.");
  return { domain, token, apiVersion };
}

export async function storefrontFetch<T>({ query, variables, buyerIp }: {
  query: string;
  variables?: Record<string, unknown>;
  buyerIp?: string | null;
}): Promise<T> {
  const { domain, token, apiVersion } = config();
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "Shopify-Storefront-Private-Token": token,
  };
  if (buyerIp) requestHeaders["Shopify-Storefront-Buyer-IP"] = buyerIp;

  const response = await fetch(`https://${domain}/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const result = (await response.json()) as StorefrontResponse<T>;
  if (!response.ok || result.errors?.length) {
    throw new Error(result.errors?.map((error) => error.message).join("; ") || `Shopify request failed (${response.status}).`);
  }
  if (!result.data) throw new Error("Shopify returned no data.");
  return result.data;
}

export async function getStorefrontProduct(): Promise<ShopifyProduct> {
  const handle = process.env.SHOPIFY_PRODUCT_HANDLE;
  if (!handle) throw new Error("SHOPIFY_PRODUCT_HANDLE is not configured.");
  const data = await storefrontFetch<{ product: (Omit<ShopifyProduct, "images" | "variants"> & {
    images: { nodes: ShopifyImage[] };
    variants: { nodes: ShopifyVariant[] };
  }) | null }>({
    query: `query StorefrontProduct($handle: String!) @inContext(country: TR) {
      product(handle: $handle) {
        id title handle description
        featuredImage { url altText width height }
        images(first: 10) { nodes { url altText width height } }
        variants(first: 50) { nodes {
          id title availableForSale quantityAvailable
          selectedOptions { name value }
          price { amount currencyCode }
        } }
      }
    }`,
    variables: { handle },
  });
  if (!data.product) throw new Error(`Shopify product "${handle}" was not found or is not published to Headless.`);
  return { ...data.product, images: data.product.images.nodes, variants: data.product.variants.nodes };
}
