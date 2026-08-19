import "dotenv/config";
import express from "express";
import multer from "multer";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { getSessionUser, hasAnyPermission } from "../db";
import { storagePut } from "../storage";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

function isAllowedCorsOrigin(origin: string) {
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (configured.includes(origin)) return true;
  if (process.env.NODE_ENV === "production") return false;
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.endsWith(".manus.computer");
  } catch {
    return false;
  }
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Permit credentialed calls only from configured production origins or managed local/preview hosts.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && isAllowedCorsOrigin(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
      res.header("Access-Control-Allow-Credentials", "true");
    } else if (origin) {
      res.sendStatus(403);
      return;
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  const mediaUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 150 * 1024 * 1024, files: 1 } });
  app.post("/api/media-upload", (req, res, next) => mediaUpload.single("file")(req, res, (error) => {
    if (!error) return next();
    const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
      ? "Choose a file smaller than 150 MB for a reliable mobile-data upload."
      : "The selected media file could not be read. Please choose it again and retry.";
    res.status(400).json({ error: message });
  }), async (req, res) => {
    try {
      const authorization = req.headers.authorization;
      const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : undefined;
      const session = token ? await getSessionUser(token) : undefined;
      if (!session || !["teacher", "admin", "super_admin"].includes(session.user.role)) {
        res.status(401).json({ error: "Staff authentication is required to upload learning media." });
        return;
      }
      if (session.user.role === "teacher" && !(await hasAnyPermission(session.user, ["course_content.manage", "media.manage"]))) {
        res.status(403).json({ error: "Your Teacher account is not permitted to upload learning media." });
        return;
      }
      const uploadedFile = req.file;
      if (!uploadedFile || !Buffer.isBuffer(uploadedFile.buffer) || uploadedFile.buffer.length === 0) {
        res.status(400).json({ error: "Choose a non-empty video or PDF file to upload." });
        return;
      }
      const declaredMimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType : "";
      const mimeType = (uploadedFile.mimetype || declaredMimeType || "application/octet-stream").split(";")[0].toLowerCase();
      if (!(mimeType === "application/pdf" || mimeType.startsWith("video/"))) {
        res.status(415).json({ error: "Only PDF notes and video files can be uploaded." });
        return;
      }
      const rawName = uploadedFile.originalname || "learning-media";
      const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160) || "learning-media";
      const kind = mimeType === "application/pdf" ? "pdf" : "video";
      const stored = await storagePut(`learning-media/${session.user.id}/${kind}_${Date.now()}_${safeName}`, uploadedFile.buffer, mimeType);
      res.status(201).json({ key: stored.key, url: stored.url, mimeType, sizeBytes: uploadedFile.buffer.length, provider: "managed_storage" });
    } catch (error) {
      console.error("[media-upload] Failed", error);
      res.status(500).json({ error: "The media upload could not be completed. Please try again on a stable connection." });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
