/**
 * Visit documentation templates: section templates and global visit templates.
 * Auth: doctor (own templates only) or admin.
 * All user-facing names/labels in Polish per spec.
 */
const SectionTemplate = require("../models/sectionTemplate");
const GlobalVisitTemplate = require("../models/globalVisitTemplate");
const mongoose = require("mongoose");

const SECTION_KEYS = SectionTemplate.SECTION_KEYS;
const SECTION_LABELS_PL = SectionTemplate.SECTION_LABELS_PL;

function getDoctorId(req) {
  if (req.user?.role === "admin" && req.query?.doctorId) return req.query.doctorId;
  return req.user?.id;
}

function ensureDoctor(req, res) {
  const doctorId = getDoctorId(req);
  if (!doctorId) {
    return res.status(403).json({ success: false, message: "Dostęp tylko dla lekarza lub administratora" });
  }
  return doctorId;
}

// --------------- Section template keys/labels (for FE dropdowns) ---------------
exports.getSectionKeys = (req, res) => {
  return res.status(200).json({
    success: true,
    data: SECTION_KEYS.map((key) => ({ key, label: SECTION_LABELS_PL[key] || key })),
  });
};

// --------------- Section templates CRUD ---------------
exports.listSectionTemplates = async (req, res) => {
  try {
    const doctorId = ensureDoctor(req, res);
    if (typeof doctorId === "undefined") return;
    const sectionKey = req.query.sectionKey;
    const query = { doctorId };
    if (sectionKey && SECTION_KEYS.includes(sectionKey)) query.sectionKey = sectionKey;
    const list = await SectionTemplate.find(query).sort({ updatedAt: -1 }).lean();
    return res.status(200).json({ success: true, data: list });
  } catch (err) {
    console.error("List section templates error:", err);
    return res.status(500).json({ success: false, message: "Błąd serwera", error: err.message });
  }
};

exports.createSectionTemplate = async (req, res) => {
  try {
    const doctorId = ensureDoctor(req, res);
    if (typeof doctorId === "undefined") return;
    const { sectionKey, name, content } = req.body;
    if (!sectionKey || !SECTION_KEYS.includes(sectionKey)) {
      return res.status(400).json({
        success: false,
        message: `sectionKey musi być jednym z: ${SECTION_KEYS.join(", ")}`,
      });
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, message: "Pole name (nazwa szablonu) jest wymagane" });
    }
    const doc = await SectionTemplate.create({
      doctorId,
      sectionKey,
      name: name.trim(),
      content: typeof content === "string" ? content : "",
    });
    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error("Create section template error:", err);
    return res.status(500).json({ success: false, message: "Błąd serwera", error: err.message });
  }
};

exports.updateSectionTemplate = async (req, res) => {
  try {
    const doctorId = ensureDoctor(req, res);
    if (typeof doctorId === "undefined") return;
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Nieprawidłowy identyfikator szablonu" });
    }
    const template = await SectionTemplate.findOne({ _id: id, doctorId });
    if (!template) {
      return res.status(404).json({ success: false, message: "Szablon nie znaleziony" });
    }
    const { name, content } = req.body;
    if (name !== undefined) template.name = typeof name === "string" ? name.trim() : template.name;
    if (content !== undefined) template.content = typeof content === "string" ? content : template.content;
    await template.save();
    return res.status(200).json({ success: true, data: template });
  } catch (err) {
    console.error("Update section template error:", err);
    return res.status(500).json({ success: false, message: "Błąd serwera", error: err.message });
  }
};

exports.deleteSectionTemplate = async (req, res) => {
  try {
    const doctorId = ensureDoctor(req, res);
    if (typeof doctorId === "undefined") return;
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Nieprawidłowy identyfikator szablonu" });
    }
    const result = await SectionTemplate.findOneAndDelete({ _id: id, doctorId });
    if (!result) {
      return res.status(404).json({ success: false, message: "Szablon nie znaleziony" });
    }
    return res.status(200).json({ success: true, message: "Szablon usunięty" });
  } catch (err) {
    console.error("Delete section template error:", err);
    return res.status(500).json({ success: false, message: "Błąd serwera", error: err.message });
  }
};

// --------------- Global visit templates CRUD ---------------
exports.listGlobalTemplates = async (req, res) => {
  try {
    const doctorId = ensureDoctor(req, res);
    if (typeof doctorId === "undefined") return;
    const list = await GlobalVisitTemplate.find({ doctorId }).sort({ updatedAt: -1 }).lean();
    return res.status(200).json({ success: true, data: list });
  } catch (err) {
    console.error("List global templates error:", err);
    return res.status(500).json({ success: false, message: "Błąd serwera", error: err.message });
  }
};

exports.createGlobalTemplate = async (req, res) => {
  try {
    const doctorId = ensureDoctor(req, res);
    if (typeof doctorId === "undefined") return;
    const { name, sections } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, message: "Pole name (nazwa szablonu globalnego) jest wymagane" });
    }
    const sec = typeof sections === "object" && sections !== null ? sections : {};
    const doc = await GlobalVisitTemplate.create({
      doctorId,
      name: name.trim(),
      sections: {
        interview: typeof sec.interview === "string" ? sec.interview : "",
        physicalExamination: typeof sec.physicalExamination === "string" ? sec.physicalExamination : "",
        treatment: typeof sec.treatment === "string" ? sec.treatment : "",
        recommendations: typeof sec.recommendations === "string" ? sec.recommendations : "",
        notes: typeof sec.notes === "string" ? sec.notes : "",
      },
    });
    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error("Create global template error:", err);
    return res.status(500).json({ success: false, message: "Błąd serwera", error: err.message });
  }
};

exports.updateGlobalTemplate = async (req, res) => {
  try {
    const doctorId = ensureDoctor(req, res);
    if (typeof doctorId === "undefined") return;
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Nieprawidłowy identyfikator szablonu" });
    }
    const template = await GlobalVisitTemplate.findOne({ _id: id, doctorId });
    if (!template) {
      return res.status(404).json({ success: false, message: "Szablon nie znaleziony" });
    }
    const { name, sections } = req.body;
    if (name !== undefined && typeof name === "string") template.name = name.trim();
    if (typeof sections === "object" && sections !== null) {
      SECTION_KEYS.forEach((key) => {
        if (typeof sections[key] === "string") template.sections[key] = sections[key];
      });
    }
    await template.save();
    return res.status(200).json({ success: true, data: template });
  } catch (err) {
    console.error("Update global template error:", err);
    return res.status(500).json({ success: false, message: "Błąd serwera", error: err.message });
  }
};

exports.deleteGlobalTemplate = async (req, res) => {
  try {
    const doctorId = ensureDoctor(req, res);
    if (typeof doctorId === "undefined") return;
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Nieprawidłowy identyfikator szablonu" });
    }
    const result = await GlobalVisitTemplate.findOneAndDelete({ _id: id, doctorId });
    if (!result) {
      return res.status(404).json({ success: false, message: "Szablon nie znaleziony" });
    }
    return res.status(200).json({ success: true, message: "Szablon usunięty" });
  } catch (err) {
    console.error("Delete global template error:", err);
    return res.status(500).json({ success: false, message: "Błąd serwera", error: err.message });
  }
};
