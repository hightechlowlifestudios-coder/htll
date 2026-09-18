import { storefrontFetch } from "../../../lib/shopify";

const CART_FIELDS = `id checkoutUrl totalQuantity
  cost { subtotalAmount { amount currencyCode } }
  lines(first: 20) { nodes { id quantity merchandise { ... on ProductVariant {
    id title selectedOptions { name value } price { amount currencyCode }
    image { url altText } product { title featuredImage { url altText } }
  } } } }`;

type CartRequest = {
  action?: "get" | "add" | "update" | "remove";
  cartId?: string;
  lineId?: string;
  merchandiseId?: string;
  quantity?: number;
};

function buyerIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("cf-connecting-ip");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CartRequest;
    const action = body.action ?? "add";
    const ip = buyerIp(request);

    if (action === "get") {
      if (!body.cartId) return Response.json({ cart: null });
      const data = await storefrontFetch<{ cart: unknown }>({
        query: `query Cart($id: ID!) @inContext(country: TR) { cart(id: $id) { ${CART_FIELDS} } }`,
        variables: { id: body.cartId }, buyerIp: ip,
      });
      return Response.json(data);
    }
    if (action === "remove") {
      if (!body.cartId || !body.lineId) return Response.json({ error: "Cart and line are required." }, { status: 400 });
      const data = await storefrontFetch<{ cartLinesRemove: { cart: unknown; userErrors: Array<{ message: string }> } }>({
        query: `mutation RemoveLine($cartId: ID!, $lineIds: [ID!]!) @inContext(country: TR) {
          cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ${CART_FIELDS} } userErrors { message } }
        }`,
        variables: { cartId: body.cartId, lineIds: [body.lineId] }, buyerIp: ip,
      });
      return Response.json({ cart: data.cartLinesRemove.cart, userErrors: data.cartLinesRemove.userErrors });
    }
    if (action === "update") {
      if (!body.cartId || !body.lineId || !body.merchandiseId) return Response.json({ error: "Cart, line, and variant are required." }, { status: 400 });
      const data = await storefrontFetch<{ cartLinesUpdate: { cart: unknown; userErrors: Array<{ message: string }> } }>({
        query: `mutation UpdateLine($cartId: ID!, $lines: [CartLineUpdateInput!]!) @inContext(country: TR) {
          cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ${CART_FIELDS} } userErrors { message } }
        }`,
        variables: { cartId: body.cartId, lines: [{ id: body.lineId, merchandiseId: body.merchandiseId, quantity: body.quantity ?? 1 }] }, buyerIp: ip,
      });
      return Response.json({ cart: data.cartLinesUpdate.cart, userErrors: data.cartLinesUpdate.userErrors });
    }
    if (!body.merchandiseId) return Response.json({ error: "Variant is required." }, { status: 400 });
    if (body.cartId) {
      const data = await storefrontFetch<{ cartLinesAdd: { cart: unknown; userErrors: Array<{ message: string }> } }>({
        query: `mutation AddLine($cartId: ID!, $lines: [CartLineInput!]!) @inContext(country: TR) {
          cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ${CART_FIELDS} } userErrors { message } }
        }`,
        variables: { cartId: body.cartId, lines: [{ merchandiseId: body.merchandiseId, quantity: body.quantity ?? 1 }] }, buyerIp: ip,
      });
      return Response.json({ cart: data.cartLinesAdd.cart, userErrors: data.cartLinesAdd.userErrors });
    }
    const data = await storefrontFetch<{ cartCreate: { cart: unknown; userErrors: Array<{ message: string }> } }>({
      query: `mutation CreateCart($input: CartInput!) @inContext(country: TR) {
        cartCreate(input: $input) { cart { ${CART_FIELDS} } userErrors { message } }
      }`,
      variables: { input: { lines: [{ merchandiseId: body.merchandiseId, quantity: body.quantity ?? 1 }], buyerIdentity: { countryCode: "TR" } } }, buyerIp: ip,
    });
    return Response.json({ cart: data.cartCreate.cart, userErrors: data.cartCreate.userErrors });
  } catch (error) {
    console.error("Shopify cart error", error);
    return Response.json({ error: error instanceof Error ? error.message : "Cart request failed." }, { status: 500 });
  }
}
