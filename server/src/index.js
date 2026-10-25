import "dotenv/config";
import express from "express";
import cors from "cors";
import aiRoutes from "./routes/ai.js";
import studentRoutes from "./routes/student.js";
import authRoutes from "./routes/auth.js";

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.send("AI Guru API is running.");
});

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    service: "AI Guru API",
    provider: "Gemini",
    apiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/students", studentRoutes);

app.use((err, _req, res, _next) => {
  console.error("Unhandled API error:", err);

  res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
});

app.listen(PORT, () => {
  console.log(`AI Guru API running at http://localhost:${PORT}`);
});