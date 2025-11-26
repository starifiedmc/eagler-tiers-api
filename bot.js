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
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;       // staff log channel
const RESULTS_CHANNEL_ID = process.env.RESULTS_CHANNEL_ID; // public test results channel

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
    ),

  // /result
  new SlashCommandBuilder()
    .setName("result")
    .setDescription("Post a public test result for a player.")
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
        .setDescription("Tier the player achieved (HT1, LT4, etc.)")
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
  console.log("✅ Registered /settier, /removetier and /result commands");
}

// =========================
// LOGGING HELPERS
// =========================

async function sendEmbedToChannel(channelId, embed) {
  if (!channelId) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return;
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("Failed to send embed to channel", channelId, err);
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

  // -------------------------
  // /settier
  // -------------------------
  if (command === "settier") {
    const player = interaction.options.getString("player");
    const gamemodeId = interaction.options.getString("gamemode");
    const tierName = interaction.options.getString("tier");

    await interaction.deferReply({ ephemeral: true });

    const moderatorTag = interaction.user.tag;
    const moderatorId = interaction.user.id;
    const now = new Date();
    const nowIso = now.toISOString();

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

      const embed = new EmbedBuilder()
        .setColor(0x4caf50)
        .setTitle("Tier Updated")
        .addFields(
          { name: "Moderator", value: `<@${moderatorId}>`, inline: true },
          { name: "Player", value: `\`${player}\``, inline: true },
          { name: "Gamemode", value: `\`${gamemodeId}\``, inline: true },
          { name: "New Tier", value: `\`${tierName}\``, inline: true }
        )
        .setTimestamp(now);

      await sendEmbedToChannel(LOG_CHANNEL_ID, embed);

      await interaction.editReply(
        `✅ Set **${player}** to **${tierName}** in **${gamemodeId}**`
      );
    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Error talking to the API.");
    }
  }

  // -------------------------
  // /removetier
  // -------------------------
  if (command === "removetier") {
    const player = interaction.options.getString("player");
    const gamemodeId = interaction.options.getString("gamemode");

    await interaction.deferReply({ ephemeral: true });

    const moderatorTag = interaction.user.tag;
    const moderatorId = interaction.user.id;
    const now = new Date();
    const nowIso = now.toISOString();

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
        .setTimestamp(now);

      await sendEmbedToChannel(LOG_CHANNEL_ID, embed);

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

  // -------------------------
  // /result  (public test result, no API changes)
  // -------------------------
  if (command === "result") {
    const player = interaction.options.getString("player");
    const gamemodeId = interaction.options.getString("gamemode");
    const tierName = interaction.options.getString("tier");

    await interaction.deferReply({ ephemeral: true });

    const testerTag = interaction.user.tag;
    const testerId = interaction.user.id;
    const now = new Date();
    const prettyDate = now.toLocaleString();

    const embed = new EmbedBuilder()
      .setColor(0x2196f3)
      .setTitle("Tier Test Result")
      .setDescription(`Test result submitted by <@${testerId}>`)
      .addFields(
        { name: "Player", value: `\`${player}\``, inline: true },
        { name: "Gamemode", value: `\`${gamemodeId}\``, inline: true },
        { name: "Result Tier", value: `\`${tierName}\``, inline: true },
        { name: "Tester", value: testerTag, inline: true },
        { name: "Date", value: prettyDate, inline: false }
      )
      .setTimestamp(now);

    try {
      if (!RESULTS_CHANNEL_ID) {
        await interaction.editReply(
          "⚠️ Results channel is not configured. Ask an admin to set `RESULTS_CHANNEL_ID`."
        );
        return;
      }

      await sendEmbedToChannel(RESULTS_CHANNEL_ID, embed);

      await interaction.editReply(
        `📊 Posted test result: **${player}** → **${tierName}** in **${gamemodeId}**.`
      );
    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Failed to post result.");
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
