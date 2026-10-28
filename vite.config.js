import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { generatePetAssetsWithImage2 } from "./scripts/image2-provider.mjs";
import petActionManifest from "./scripts/pet-action-manifest.mjs";

function image2LocalApi() {
  return {
    name: "image2-local-api",
    configureServer(server) {
      server.middlewares.use("/api/generate", (request, response) => {
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.end("Method Not Allowed");
          return;
        }

        let raw = "";
        request.on("data", (chunk) => {
          raw += chunk;
          if (raw.length > 180 * 1024 * 1024) request.destroy();
        });
        request.on("end", async () => {
          try {
            const body = JSON.parse(raw || "{}");
            const authorization = request.headers.authorization || "";
            const apiKey = authorization.replace(/^Bearer\s+/i, "") || process.env.OPENAI_API_KEY || "";
            const result = await generatePetAssetsWithImage2({
              photos: body.photos,
              apiKey,
              model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
            });
            response.statusCode = 200;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify(result));
          } catch (error) {
            response.statusCode = /API Key|至少上传/.test(error.message) ? 400 : 502;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify({ error: error.message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  // Electron production pages are loaded from file://, so renderer assets
  // must use relative URLs instead of root-relative /assets URLs.
  base: "./",
  plugins: [react(), tailwindcss(), image2LocalApi(), petActionManifest()],
});
