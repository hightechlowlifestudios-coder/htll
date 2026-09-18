"use client";

import { useEffect, useMemo, useState } from "react";
import type { ShopifyProduct, ShopifyVariant } from "./lib/shopify";

type CartLine = {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    selectedOptions: Array<{ name: string; value: string }>;
    price: { amount: string; currencyCode: string };
    image: { url: string; altText: string | null } | null;
    product: { title: string; featuredImage: { url: string; altText: string | null } | null };
  };
};
type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: { amount: string; currencyCode: string } };
  lines: { nodes: CartLine[] };
};

const CART_KEY = "htll-shopify-cart-id";

function money(amount: string, currencyCode: string) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: currencyCode, maximumFractionDigits: 2,
  }).format(Number(amount));
}

function optionLabel(variant: ShopifyVariant) {
  return variant.selectedOptions.map((option) => option.value).join(" / ") || variant.title;
}

export function Storefront({ product }: { product: ShopifyProduct }) {
  const firstAvailable = product.variants.find((variant) => variant.availableForSale) ?? product.variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState(firstAvailable?.id ?? "");
  const [bagOpen, setBagOpen] = useState(false);
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [cartError, setCartError] = useState("");
  const selectedVariant = useMemo(
    () => product.variants.find((variant) => variant.id === selectedVariantId) ?? firstAvailable,
    [firstAvailable, product.variants, selectedVariantId],
  );
  const currentLine = cart?.lines.nodes[0] ?? null;
  const productImage = product.featuredImage ?? product.images[0] ?? null;

  useEffect(() => {
    document.body.style.overflow = bagOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [bagOpen]);

  useEffect(() => {
    const cartId = window.localStorage.getItem(CART_KEY);
    if (!cartId) return;
    fetch("/api/shopify/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get", cartId }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.cart) setCart(data.cart);
        else window.localStorage.removeItem(CART_KEY);
      })
      .catch(() => window.localStorage.removeItem(CART_KEY));
  }, []);

  async function cartRequest(body: Record<string, unknown>) {
    setLoading(true);
    setCartError("");
    try {
      const response = await fetch("/api/shopify/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || data.error || data.userErrors?.length) {
        throw new Error(data.error ?? data.userErrors?.map((error: { message: string }) => error.message).join("; ") ?? "Sepet güncellenemedi.");
      }
      setCart(data.cart);
      if (data.cart?.id) window.localStorage.setItem(CART_KEY, data.cart.id);
      if (!data.cart?.totalQuantity) window.localStorage.removeItem(CART_KEY);
      return data.cart as Cart;
    } catch (error) {
      setCartError(error instanceof Error ? error.message : "Sepet güncellenemedi.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function addToBag() {
    if (!selectedVariant?.availableForSale) return;
    const nextCart = await cartRequest({
      action: currentLine ? "update" : "add",
      cartId: cart?.id,
      lineId: currentLine?.id,
      merchandiseId: selectedVariant.id,
      quantity: 1,
    });
    if (nextCart) setBagOpen(true);
  }

  async function removeFromBag() {
    if (!cart?.id || !currentLine?.id) return;
    await cartRequest({ action: "remove", cartId: cart.id, lineId: currentLine.id });
  }

  return (
    <main>
      <a className="skip-link" href="#pant">Ürüne geç</a>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="High Tech Low Life ana sayfa">HTLL</a>
        <nav aria-label="Ana menü"><a href="#pant">Pantalon</a><a href="#details">Detaylar</a></nav>
        <button className="bag-button" onClick={() => setBagOpen(true)}>Sepet <sup>{cart?.totalQuantity ?? 0}</sup></button>
      </header>

      <section className="artwork-hero" id="top" aria-label="High Tech Low Life Drop 001">
        <img src="/hero-symbol.png" alt="Açık renk dokulu zeminde siyah üç uçlu sembol" />
        <div className="hero-meta hero-meta-left">DROP 001<br />2026</div>
        <div className="hero-meta hero-meta-right">TEK FORM<br />TEK EDİSYON</div>
        <a className="scroll-cue" href="#pant">Ürünü gör <span>↓</span></a>
      </section>

      <section className="product" id="pant">
        <div className="product-image-wrap">
          <p className="image-count">01 / {String(Math.max(product.images.length, 1)).padStart(2, "0")}</p>
          <img className="pant-image" src={productImage?.url ?? "/pant-product.png"} alt={productImage?.altText ?? product.title} />
        </div>
        <div className="product-info"><div className="product-sticky">
          <p className="eyebrow">High Tech Low Life / Drop 001</p>
          <h1>{product.title}</h1>
          {selectedVariant && <p className="price">{money(selectedVariant.price.amount, selectedVariant.price.currencyCode)}</p>}
          <p className="description">{product.description || "Tek bir form. Gereksiz hiçbir şey yok."}</p>

          <fieldset className="size-picker">
            <legend>Beden seç</legend>
            <div style={{ gridTemplateColumns: `repeat(${Math.max(product.variants.length, 1)}, 1fr)` }}>
              {product.variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  className={selectedVariantId === variant.id ? "selected" : ""}
                  onClick={() => setSelectedVariantId(variant.id)}
                  aria-pressed={selectedVariantId === variant.id}
                  disabled={!variant.availableForSale}
                  title={variant.availableForSale ? `${variant.quantityAvailable ?? ""} adet stokta` : "Tükendi"}
                >
                  {optionLabel(variant)}
                </button>
              ))}
            </div>
          </fieldset>

          <button className="add-button" onClick={addToBag} disabled={loading || !selectedVariant?.availableForSale}>
            <span>{loading ? "Ekleniyor…" : currentLine ? "Sepeti güncelle" : "Sepete ekle"}</span>
            {selectedVariant && <span>{money(selectedVariant.price.amount, selectedVariant.price.currencyCode)}</span>}
          </button>
          {cartError && <p className="cart-error" role="alert">{cartError}</p>}

          <div className="product-notes" id="details">
            <details open><summary>Ürün bilgisi</summary><p>{product.description || "Ürün açıklaması yakında eklenecek."}</p></details>
            <details><summary>Stok</summary><p>Stok ve beden bilgileri Shopify üzerinden canlı olarak güncellenir.</p></details>
            <details><summary>Kargo ve iade</summary><p>Kargo ücretleri ve teslimat seçenekleri Shopify ödeme sayfasında hesaplanır.</p></details>
          </div>
        </div></div>
      </section>

      <section className="statement"><img src="/hero-symbol.png" alt="" aria-hidden="true" /><p>Tek ürün.<br />Gereksiz hiçbir şey yok.</p></section>
      <footer>
        <div><a className="footer-mark" href="#top">HTLL</a><p>High Tech Low Life Studios.<br />İstanbul</p></div>
        <div className="footer-links"><a href="#pant">Ürün</a><a href="#details">Beden</a><a href="#top">Instagram</a></div>
        <div className="footer-legal"><span>© 2026 HTLL</span><span>Koşullar · Gizlilik</span></div>
      </footer>

      <div className={`overlay ${bagOpen ? "visible" : ""}`} onClick={() => setBagOpen(false)} />
      <aside className={`bag-drawer ${bagOpen ? "open" : ""}`} aria-hidden={!bagOpen} aria-label="Alışveriş sepeti">
        <div className="drawer-head"><p>Sepetiniz ({cart?.totalQuantity ?? 0})</p><button onClick={() => setBagOpen(false)} aria-label="Sepeti kapat">×</button></div>
        {currentLine && cart ? (
          <>
            <div className="bag-line">
              <img src={currentLine.merchandise.image?.url ?? currentLine.merchandise.product.featuredImage?.url ?? "/pant-product.png"} alt={currentLine.merchandise.product.title} />
              <div><h2>{currentLine.merchandise.product.title}</h2><p>{currentLine.merchandise.selectedOptions.map((option) => `${option.name}: ${option.value}`).join(" · ")}</p><button onClick={removeFromBag} disabled={loading}>Kaldır</button></div>
              <p>{money(currentLine.merchandise.price.amount, currentLine.merchandise.price.currencyCode)}</p>
            </div>
            <div className="drawer-total">
              <div><span>Ara toplam</span><span>{money(cart.cost.subtotalAmount.amount, cart.cost.subtotalAmount.currencyCode)}</span></div>
              <button onClick={() => window.location.assign(cart.checkoutUrl)}>Ödemeye devam et</button>
              <p>Güvenli ödeme Shopify üzerinden tamamlanır.</p>
            </div>
          </>
        ) : (
          <div className="empty-bag"><p>Sepetiniz boş.</p><button onClick={() => { setBagOpen(false); document.querySelector("#pant")?.scrollIntoView(); }}>Pantalonu gör</button></div>
        )}
      </aside>
    </main>
  );
}
