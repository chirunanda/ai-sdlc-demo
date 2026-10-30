import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App.jsx";

afterEach(() => vi.restoreAllMocks());

describe("App", () => {
  it("shows products returned by the BFF", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 1, name: "Trail Backpack", category: "Outdoor", price: "$89.00", availability: "In stock" },
          { id: 2, name: "Headlamp", category: "Outdoor", price: "$35.00", availability: "Sold out" },
        ],
      })
    );
    render(<App />);
    expect(await screen.findByText("Trail Backpack")).toBeInTheDocument();
    expect(screen.getByText("Sold out")).toBeInTheDocument();
  });

  it("shows a helpful message when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be loaded/i);
  });
});
