import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = "./tiers.json";

// Known gamemodes and tiers
const GAMEMODES = [
  "vanilla-pvp",
  "mace-pvp",
  "axe-pvp",
  "sword-pvp",
  "smp",
  "diamond-smp",
  "uhc",
  "pot-pvp",
  "neth-op"
];

const TIERS = [
  "HT1", "LT1",
  "HT2", "LT2",
  "HT3", "LT3",
  "HT4", "LT4",
  "HT5", "LT5"
];

// Create an empty structure for one gamemode
function emptyGamemode() {
  const obj = {};
  for (const t of TIERS) {
    obj[t] = [];
  }
  return obj;
}

// Load tiers.json or make a default empty structure
function loadTiers() {
  if (!fs.existsSync(DATA_FILE)) {
    const base = {};
    for (const gm of GAMEMODES) {
      base[gm] = emptyGamemode();
    }
    return base;
  }
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

// Save tiers.json
function saveTiers(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// --------------------------
// GET /tiers  (used by website)
// --------------------------
app.get("/tiers", (req, res) => {
  try {
    const data = loadTiers();
    res.json(data);
  } catch (err) {
    console.error("Failed to load tiers:", err);
    res.status(500).json({ error: "Failed to load tiers" });
  }
});

// --------------------------
// POST /setTier
// body: { player, gamemodeId, tierName, modifiedBy, modifiedById, modifiedAt }
// --------------------------
app.post("/setTier", (req, res) => {
  const { player, gamemodeId, tierName, modifiedBy, modifiedById, modifiedAt } = req.body;

  if (!player || !gamemodeId || !tierName) {
    return res.status(400).json({ error: "Missing player, gamemodeId or tierName" });
  }

  // Normalize
  const playerName = String(player).trim();
  const gmId = String(gamemodeId).trim();
  const tier = String(tierName).trim().toUpperCase();

  if (!GAMEMODES.includes(gmId)) {
    return res.status(400).json({ error: "Invalid gamemodeId" });
  }
  if (!TIERS.includes(tier)) {
    return res.status(400).json({ error: "Invalid tierName" });
  }

  const data = loadTiers();

  // Ensure gamemode structure exists
  if (!data[gmId]) {
    data[gmId] = emptyGamemode();
  }

  // Ensure tiers exist for that gamemode
  for (const t of TIERS) {
    if (!Array.isArray(data[gmId][t])) {
      data[gmId][t] = [];
    }
  }

  // Remove player from ALL tiers in this gamemode
  for (const t of TIERS) {
    data[gmId][t] = data[gmId][t].filter(
      (p) => p.name.toLowerCase() !== playerName.toLowerCase()
    );
  }

  // Add them to the new tier with metadata
  data[gmId][tier].push({
    name: playerName,
    lastModifiedBy: modifiedBy || null,
    lastModifiedById: modifiedById || null,
    lastModifiedAt: modifiedAt || new Date().toISOString()
  });

  saveTiers(data);
  return res.json({ success: true });
});

// --------------------------
// POST /removeTier
// body: { player, gamemodeId, modifiedBy, modifiedById, modifiedAt }
// --------------------------
app.post("/removeTier", (req, res) => {
  const { player, gamemodeId } = req.body;

  if (!player || !gamemodeId) {
    return res.status(400).json({ error: "Missing player or gamemodeId" });
  }

  const playerName = String(player).trim();
  const gmId = String(gamemodeId).trim();

  if (!GAMEMODES.includes(gmId)) {
    return res.status(400).json({ error: "Invalid gamemodeId" });
  }

  const data = loadTiers();

  if (!data[gmId]) {
    data[gmId] = emptyGamemode();
  }

  let removedCount = 0;

  for (const t of TIERS) {
    const before = (data[gmId][t] || []).length;
    data[gmId][t] = (data[gmId][t] || []).filter(
      (p) => p.name.toLowerCase() !== playerName.toLowerCase()
    );
    removedCount += before - data[gmId][t].length;
  }

  saveTiers(data);

  return res.json({ success: true, removed: removedCount });
});

// --------------------------
// START SERVER
// --------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Eagler tiers API listening on port " + PORT);
});
