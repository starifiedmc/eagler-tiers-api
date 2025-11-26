// bot.js - Discord bot for updating Eagler tiers

import express from "express";
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";
import fetch from "node-fetch";

// =========================
// ENV VARS
// =========================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const API_URL = process.env.API_URL || "https://eagler-tiers-api.onrender.com";

// Safety check
if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("Missing DISCORD_TOKEN, CLIENT_ID or GUILD_ID env vars.");
  process.exit(1);
}

// =========================
// DISCORD CLIENT
// =========================

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// =========================
// SLASH COMMAND DEFINITIONS
// =========================

const commands = [
  // /settier
  new SlashCommandBuilder()
    .setName("settier")
    .setDescription("Set a player's tier in a specific gamemode.")
    .addStringOption(opt =>
      opt.setName("player")
        .setDescription("Player's name (IGN)")
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("gamemode")
        .setDescription("Gamemode ID (vanilla-pvp, mace-pvp, ...)")
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("tier")
        .setDescription("Tier (HT1, LT1, ... HT5, LT5)")
        .setRequired(true)
    ),

  // /removetier
  new SlashCommandBuilder()
    .setName("removetier")
    .setDescription("Remove a player from all tiers in a gamemode.")
    .addStringOption(opt =>
      opt.setName("player")
        .setDescription("Player's name (IGN)")
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("gamemode")
        .setDescription("Gamemode ID (vanilla-pvp, mace-pvp, ...)")
        .setRequired(true)
    )
].map(c => c.toJSON());

// =========================
// REGISTER COMMANDS
// =========================

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
  console.log("✅ Registered /settier and /removetier commands");
}

// =========================
// EVENT HANDLERS
// =========================

client.on("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  try {
    await registerCommands();
  } catch (err) {
    console.error("Failed to register commands:", err);
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;

  if (command === "settier") {
    const player = interaction.options.getString("player");
    const gamemodeId = interaction.options.getString("gamemode");
    const tierName = interaction.options.getString("tier");

    await interaction.deferReply({ ephemeral: true });

    try {
      const res = await fetch(`${API_URL}/setTier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player, gamemodeId, tierName })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("API error:", data);
        return interaction.editReply(
          `❌ Failed: ${data.error || res.statusText}`
        );
      }

      await interaction.editReply(
        `✅ Set **${player}** to **${tierName}** in **${gamemodeId}**`
      );
    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Error talking to the API.");
    }
  }

  if (command === "removetier") {
    const player = interaction.options.getString("player");
    const gamemodeId = interaction.options.getString("gamemode");

    await interaction.deferReply({ ephemeral: true });

    try {
      const res = await fetch(`${API_URL}/removeTier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player, gamemodeId })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("API error:", data);
        return interaction.editReply(
          `❌ Failed: ${data.error || res.statusText}`
        );
      }

      if (data.removed > 0) {
        await interaction.editReply(
          `✅ Removed **${player}** from **${gamemodeId}** (removed from ${data.removed} tier(s)).`
        );
      } else {
        await interaction.editReply(
          `ℹ️ **${player}** was not found in any tier for **${gamemodeId}**.`
        );
      }
    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Error talking to the API.");
    }
  }
});

// =========================
// TINY WEB SERVER FOR RENDER
// =========================

const pingApp = express();
pingApp.get("/", (req, res) => {
  res.send("EaglerTiers bot is running");
});

const PORT = process.env.PORT || 3000;
pingApp.listen(PORT, () => {
  console.log("Bot web server listening on port " + PORT);
});

// =========================
// LOGIN
// =========================

client.login(TOKEN);
