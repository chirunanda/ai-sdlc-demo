import express from "express";

/**
 * Backend-for-frontend: shapes the Java API's responses for the React UI.
 * @param {{ apiBaseUrl: string }} options
 */
export function createApp({ apiBaseUrl }) {
  const app = express();

  const toView = (p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: `$${(p.priceCents / 100).toFixed(2)}`,
    availability: p.stock > 0 ? "In stock" : "Sold out",
  });

  async function fetchApi(path) {
    const res = await fetch(`${apiBaseUrl}${path}`);
    return res;
  }

  app.get("/health", (_req, res) => res.json({ status: "UP" }));

  app.get("/api/products", async (_req, res) => {
    try {
      const upstream = await fetchApi("/api/products");
      if (!upstream.ok) return res.status(502).json({ error: "Catalog service error" });
      const products = await upstream.json();
      res.json(products.map(toView));
    } catch {
      res.status(502).json({ error: "Catalog service unreachable" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const upstream = await fetchApi(`/api/products/${encodeURIComponent(req.params.id)}`);
      if (upstream.status === 404) return res.status(404).json({ error: "Product not found" });
      if (!upstream.ok) return res.status(502).json({ error: "Catalog service error" });
      res.json(toView(await upstream.json()));
    } catch {
      res.status(502).json({ error: "Catalog service unreachable" });
    }
  });

  return app;
}
