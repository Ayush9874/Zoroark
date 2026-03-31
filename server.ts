import express, { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import http from "http";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Proxy /api/* → FastAPI on port 8000.
  //
  // We use Node's built-in http module instead of http-proxy-middleware.
  // HPM v3 modifies req.url before forwarding — when mounted at "/api",
  // Express strips the prefix so req.url becomes "/plan", and HPM forwards
  // that stripped path, causing FastAPI to receive /plan instead of
  // /api/plan → 404.
  //
  // Here we reconstruct the full path explicitly: "/api" + req.url.
  app.use("/api", (req: Request, res: Response) => {
    const fullPath = "/api" + req.url; // restore the /api prefix Express stripped
    const body: Buffer[] = [];

    req.on("data", (chunk: Buffer) => body.push(chunk));
    req.on("end", () => {
      const bodyBuffer = Buffer.concat(body);
      const options: http.RequestOptions = {
        hostname: "localhost",
        port: 8000,
        path: fullPath,
        method: req.method,
        headers: {
          ...req.headers,
          host: "localhost:8000",
          "content-length": bodyBuffer.length.toString(),
        },
      };

      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      });

      proxyReq.on("error", (err) => {
        console.error("[proxy] FastAPI unreachable:", err.message);
        res.status(502).json({ detail: "FastAPI unreachable: " + err.message });
      });

      proxyReq.write(bodyBuffer);
      proxyReq.end();
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Proxying /api/* → http://localhost:8000/api/*`);
  });
}

startServer();