import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const RequestUploadUrlBody = z.object({
  name: z.string().min(1),
  size: z.number().int().nonnegative(),
  contentType: z.string().min(1),
});

/**
 * POST /storage/uploads/request-url
 * Request a presigned URL for direct-to-GCS upload.
 * Requires auth. Client sends metadata, NOT the file.
 */
router.post("/storage/uploads/request-url", requireAuth, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (error) {
    console.error("Failed to generate presigned upload URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/objects/*path
 * Serve a private uploaded object. Requires auth.
 */
router.get("/storage/objects/*path", requireAuth, async (req: Request, res: Response) => {
  const objectPath = `/objects/${(req.params as Record<string, string>).path}`;

  try {
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);

    res.setHeader("Content-Type", response.headers.get("Content-Type") ?? "application/octet-stream");
    const cacheControl = response.headers.get("Cache-Control");
    if (cacheControl) res.setHeader("Cache-Control", cacheControl);
    const contentLength = response.headers.get("Content-Length");
    if (contentLength) res.setHeader("Content-Length", contentLength);

    const body = response.body;
    if (!body) {
      res.status(204).end();
      return;
    }

    // Convert web stream to Node.js stream and pipe to response
    const nodeStream = Readable.fromWeb(body as any);
    nodeStream.pipe(res);
    nodeStream.on("error", (err) => {
      console.error("Stream error:", err);
      if (!res.headersSent) res.status(500).end();
    });
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
    } else {
      console.error("Failed to serve object:", error);
      res.status(500).json({ error: "Failed to serve object" });
    }
  }
});
export default router;
