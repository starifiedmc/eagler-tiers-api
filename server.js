import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = "./tiers.json";

// Load data from tiers.json
function loadTiers() {
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

// Save data back into tiers.json
function saveTiers(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET /tiers  -> your website uses this
app.get("/tiers", (req, res) => {
  try {
    const data = loadTiers();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load tiers" });
  }
});

// POST /setTier -> used by Discord bot
// body: { player, gamemodeId, tierName }
app.post("/setTier", (req, res) => {
  const { player, gamemodeId, tierName } = req.body;

  if (!player || !gamemodeId || !tierName) {
    return res.status(400).json({ error: "Missing player, gamemodeId or tierName" });
  }

  const data = loadTiers();

  if (!data[gamemodeId]) {
    return res.status(400).json({ error: "Invalid gamemodeId" });
  }
  if (!data[gamemodeId][tierName]) {
    return res.status(400).json({ error: "Invalid tierName" });
  }

  // remove player from all tiers in this gamemode
  for (const tier of Object.keys(data[gamemodeId])) {
    data[gamemodeId][tier] = data[gamemodeId][tier].filter(
      (p) => p.name.toLowerCase() !== player.toLowerCase()
    );
  }

  // add to new tier
  data[gamemodeId][tierName].push({ name: player });
  saveTiers(data);

  res.json({ success: true });
});

// POST /removeTier -> remove a player from ALL tiers in a gamemode
// body: { player, gamemodeId }
app.post("/removeTier", (req, res) => {
  const { player, gamemodeId } = req.body;

  if (!player || !gamemodeId) {
    return res.status(400).json({ error: "Missing player or gamemodeId" });
  }

  const data = loadTiers();

  if (!data[gamemodeId]) {
    return res.status(400).json({ error: "Invalid gamemodeId" });
  }

  let removedCount = 0;

  for (const tier of Object.keys(data[gamemodeId])) {
    const before = data[gamemodeId][tier].length;
    data[gamemodeId][tier] = data[gamemodeId][tier].filter(
      (p) => p.name.toLowerCase() !== player.toLowerCase()
    );
    removedCount += before - data[gamemodeId][tier].length;
  }

  saveTiers(data);

  res.json({ success: true, removed: removedCount });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Eagler tiers API listening on port " + PORT);
});
