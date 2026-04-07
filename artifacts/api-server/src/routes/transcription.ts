import { Router, type Request, type Response } from "express";
import multer from "multer";
import axios from "axios";
import fs from "fs";

const router = Router();
const upload = multer({ dest: "/tmp/uploads/" });
const AKEY = process.env.ASSEMBLYAI_API_KEY;
const AAPI = "https://api.assemblyai.com/v2";

const WORD_BOOST = [
  "Unifor", "JHSC", "steward", "grievance", "arbitration",
  "just cause", "collective agreement", "bargaining unit",
  "Local 1285", "OHSA", "ESA", "Saputo", "Georgetown",
  "hazard identification", "root cause analysis",
  "right to refuse", "duty to accommodate",
  "modified work", "modified duties", "ergonomics",
  "WHMIS", "lockout tagout", "LOTO", "incident report",
  "near miss", "PPE", "forklift", "racking", "cold storage",
  "Form 7", "WSIB", "accommodation plan",
  "section 25", "section 43", "section 9",
  "co-chair", "worker co-chair", "management co-chair",
  "corrective action", "inspection log",
];

router.post("/upload", upload.single("audio"), async (req: Request, res: Response) => {
  let filePath: string | null = null;
  try {
    const noKey = !AKEY;
    const noFile = !req.file;
    if (noKey) return res.status(500).json({ error: "ASSEMBLYAI_API_KEY secret not set." });
    if (noFile) return res.status(400).json({ error: "No audio file received." });
    filePath = req.file!.path;
    const fileStream = fs.createReadStream(filePath as string);
    const uploadRes = await axios.post(AAPI + "/upload", fileStream, {
      headers: {
        authorization: AKEY,
        "content-type": "application/octet-stream",
        "transfer-encoding": "chunked",
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    const audioUrl: string = uploadRes.data.upload_url;
    const noUrl = !audioUrl;
    if (noUrl) throw new Error("AssemblyAI upload returned no URL.");
    const transcriptRes = await axios.post(
      AAPI + "/transcript",
      {
        audio_url: audioUrl,
        speech_models: { model: "universal" },
        speaker_labels: true,
        word_boost: WORD_BOOST,
        boost_param: "high",
        punctuate: true,
        format_text: true,
        disfluencies: false,
      },
      { headers: { authorization: AKEY, "content-type": "application/json" } }
    );
    fs.unlinkSync(filePath as string);
    filePath = null;
    return res.json({ id: transcriptRes.data.id });
  } catch (err: any) {
    if (filePath) { try { fs.unlinkSync(filePath); } catch (_) {} }
    console.error("[transcription] upload error:", err.response?.data || err.message);
    return res.status(500).json({ error: err.response?.data?.error || err.message });
  }
});

router.get("/status/:id", async (req: Request, res: Response) => {
  try {
    const noKey = !AKEY;
    if (noKey) return res.status(500).json({ error: "ASSEMBLYAI_API_KEY secret not set." });
    const { id } = req.params;
    const result = await axios.get(AAPI + "/transcript/" + id, {
      headers: { authorization: AKEY },
    });
    const { status, text, utterances, audio_duration, words, confidence, error } = result.data;
    return res.json({ status, text, utterances, audio_duration, words, confidence, error });
  } catch (err: any) {
    console.error("[transcription] poll error:", err.response?.data || err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;