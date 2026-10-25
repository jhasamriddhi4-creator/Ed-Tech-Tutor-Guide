import { Router } from "express";
import {
  deleteLearningItem,
  getStudentData,
  isValidStudentId,
  saveLearningItem,
} from "../services/studentStore.js";

const router = Router();
const MAX_TITLE_LENGTH = 160;
const MAX_CONTENT_LENGTH = 100_000;
const ALLOWED_TYPES = new Set([
  "tutor",
  "rag",
  "code",
  "notes",
  "roadmap",
]);

function validStudentParam(req, res) {
  const studentId = req.params.studentId;

  if (!isValidStudentId(studentId)) {
    res.status(400).json({
      success: false,
      message: "The student ID is invalid. Refresh the app and try again.",
    });
    return null;
  }

  return studentId;
}

router.get("/:studentId", (req, res) => {
  const studentId = validStudentParam(req, res);
  if (!studentId) return;

  try {
    return res.json({
      success: true,
      result: getStudentData(studentId),
    });
  } catch (error) {
    console.error("Unable to load student data:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load student data.",
    });
  }
});

router.post("/:studentId/saves", (req, res) => {
  const studentId = validStudentParam(req, res);
  if (!studentId) return;

  const body = req.body || {};
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const type = typeof body.type === "string" ? body.type : "";
  const content = typeof body.content === "string" ? body.content : "";

  if (!title || title.length > MAX_TITLE_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Title must be between 1 and ${MAX_TITLE_LENGTH} characters.`,
    });
  }

  if (!ALLOWED_TYPES.has(type)) {
    return res.status(400).json({
      success: false,
      message: "This learning item type cannot be saved.",
    });
  }

  if (!content.trim() || content.length > MAX_CONTENT_LENGTH) {
    return res.status(400).json({
      success: false,
      message: "Content must be non-empty and no larger than 100,000 characters.",
    });
  }

  try {
    const item = saveLearningItem(studentId, { title, type, content });
    return res.status(201).json({ success: true, result: item });
  } catch (error) {
    console.error("Unable to save learning item:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to save this learning item.",
    });
  }
});

router.delete("/:studentId/saves/:itemId", (req, res) => {
  const studentId = validStudentParam(req, res);
  if (!studentId) return;

  try {
    const deleted = deleteLearningItem(studentId, req.params.itemId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Saved item not found.",
      });
    }

    return res.json({ success: true, result: { deleted: true } });
  } catch (error) {
    console.error("Unable to delete learning item:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to delete this learning item.",
    });
  }
});

export default router;
