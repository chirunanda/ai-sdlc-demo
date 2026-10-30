import { useEffect, useState } from "react";

export default function App() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setProducts(data);
          setStatus("ready");
        }
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="page">
      <header className="head">
        <h1>Trailhead Supply</h1>
        <p>Gear on hand this week</p>
      </header>

      {status === "loading" && <p role="status">Loading products…</p>}
      {status === "error" && (
        <p role="alert" className="error">
          Products could not be loaded. Refresh the page, or try again in a minute.
        </p>
      )}
      {status === "ready" && (
        <ul className="list">
          {products.map((p) => (
            <li key={p.id} className="row">
              <div>
                <h2>{p.name}</h2>
                <span className="cat">{p.category}</span>
              </div>
              <div className="meta">
                <span className="price">{p.price}</span>
                <span className={p.availability === "In stock" ? "ok" : "out"}>
                  {p.availability}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
