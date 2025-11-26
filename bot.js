// bot.js - Discord bot for updating Eagler tiers

import express from "express";
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} from "discord.js";
import fetch from "node-fetch";

// =========================
// ENV VARS
// =========================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const API_URL = process.env.API_URL || "https://eagler-tiers-api.onrender.com";
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID; // channel for logs

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
// SLASH COMMANDS
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
// LOGGING HELPERS
// =========================

async function logEmbed(embed) {
  if (!LOG_CHANNEL_ID) return; // logging optional

  try {
    const channel = await client.channels.fetch(LOG_CHANNEL_ID);
    if (!channel) return;
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("Failed to send log:", err);
  }
}

// =========================
// EVENTS
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

    const moderatorTag = interaction.user.tag;
    const moderatorId = interaction.user.id;
    const nowIso = new Date().toISOString();

    try {
      const res = await fetch(`${API_URL}/setTier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player,
          gamemodeId,
          tierName,
          modifiedBy: moderatorTag,
          modifiedById: moderatorId,
          modifiedAt: nowIso
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("API error:", data);
        return interaction.editReply(
          `❌ Failed: ${data.error || res.statusText}`
        );
      }

      // Log to channel with an embed
      const embed = new EmbedBuilder()
        .setColor(0x4caf50)
        .setTitle("Tier Updated")
        .addFields(
          { name: "Moderator", value: `<@${moderatorId}>`, inline: true },
          { name: "Player", value: `\`${player}\``, inline: true },
          { name: "Gamemode", value: `\`${gamemodeId}\``, inline: true },
          { name: "New Tier", value: `\`${tierName}\``, inline: true }
        )
        .setTimestamp(new Date(nowIso));

      await logEmbed(embed);

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

    const moderatorTag = interaction.user.tag;
    const moderatorId = interaction.user.id;
    const nowIso = new Date().toISOString();

    try {
      const res = await fetch(`${API_URL}/removeTier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player,
          gamemodeId,
          modifiedBy: moderatorTag,
          modifiedById: moderatorId,
          modifiedAt: nowIso
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("API error:", data);
        return interaction.editReply(
          `❌ Failed: ${data.error || res.statusText}`
        );
      }

      const removed = data.removed || 0;

      const embed = new EmbedBuilder()
        .setColor(0xf44336)
        .setTitle("Tier Removed")
        .addFields(
          { name: "Moderator", value: `<@${moderatorId}>`, inline: true },
          { name: "Player", value: `\`${player}\``, inline: true },
          { name: "Gamemode", value: `\`${gamemodeId}\``, inline: true },
          { name: "Removed Entries", value: `\`${removed}\``, inline: true }
        )
        .setTimestamp(new Date(nowIso));

      await logEmbed(embed);

      if (removed > 0) {
        await interaction.editReply(
          `✅ Removed **${player}** from **${gamemodeId}** (${removed} tier(s)).`
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
