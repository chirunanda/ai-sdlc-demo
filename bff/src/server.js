import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:8080";

createApp({ apiBaseUrl }).listen(port, "127.0.0.1", () => {
  console.log(`BFF listening on 127.0.0.1:${port}, upstream ${apiBaseUrl}`);
});
