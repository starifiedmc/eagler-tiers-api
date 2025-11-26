// bot.js - Discord bot for Eagler tiers

import express from "express";
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} from "discord.js";
import fetch from "node-fetch";

// =========================
// ENV VARS
// =========================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const API_URL = process.env.API_URL || "https://eagler-tiers-api.onrender.com";
const LOG_CHANNEL_ID = process.env.1443083985898049599;         // staff log channel
const RESULTS_CHANNEL_ID = process.env.1348582624930693140; // public results channel

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("Missing DISCORD_TOKEN, CLIENT_ID or GUILD_ID env vars.");
  process.exit(1);
}

// =========================
// ROLE MAPPING CONFIG
// =========================

// 👇 Fill these with your real Discord role IDs
const ROLE_MAP = {
  "vanilla-pvp": {
    HT1: "1443099326636359690",
    LT1: "1443108701912436870",
    HT2: "1443102932555006013",
    LT2: "1443107817530851348",
    HT3: "1443102958911881256",
    LT3: "1443106574368247870",
    HT4: "1443103998050832384",
    LT4: "1443105840369373184",
    HT5: "1443104855106392105",
    LT5: "1443105376521158688"
  },
  "mace-pvp": {
    HT1: "1443099999167582223",
    LT1: "1443108709440950422",
    HT2: "1443102953186791454",
    LT2: "1443107803295252502",
    HT3: "1443103927678799914",
    LT3: "1443106590654988505",
    HT4: "1443104412485812347",
    LT4: "1443105826075050076",
    HT5: "1443104884126781480",
    LT5: "1443105411459977236"
  },
  "axe-pvp": {
    HT1: "1443099964719763527",
    LT1: "1443108706127581235",
    HT2: "1443102950397448192",
    LT2: "1443107819581608007",
    HT3: "1443103925720055859",
    LT3: "1443106550246932540",
    HT4: "1443104410065571880",
    LT4: "1443105844953878681",
    HT5: "1443104881056415774",
    LT5: "1443105407307485195"
  },
  "sword-pvp": {
    HT1: "1443099917575782411",
    LT1: "1443108711219597312",
    HT2: "1443102947402580112",
    LT2: "1443107807783157811",
    HT3: "1443103923337429032",
    LT3: "1443106585298600027",
    HT4: "1443104407591063562",
    LT4: "1443105835554312282",
    HT5: "1443104878242168873",
    LT5: "1443105403641663749"
  },
  "smp": {
    HT1: "1443099794938658929",
    LT1: "1443108708199567360",
    HT2: "1443102944235880635",
    LT2: "1443107806302572654",
    HT3: "1443103921022308373",
    LT3: "1443106587098218567",
    HT4: "1443104399898443826",
    LT4: "1443105828709208197",
    HT5: "1443104875645763667",
    LT5: "1443105400806440960"
  },
  "diamond-smp": {
    HT1: "1443100000274878495",
    LT1: "1443023475592658954",
    HT2: "1443102955732467815",
    LT2: "1443107810366980187",
    HT3: "1443103931117994026",
    LT3: "1443106595004485632",
    HT4: "1443104427652415508",
    LT4: "1443105842479239230",
    HT5: "1443104887859707904",
    LT5: "1443105413678633044"
  },
  "uhc": {
    HT1: "1443099402498605086",
    LT1: "1443108713287258222",
    HT2: "1443102936036282408",
    LT2: "1443107813797920930",
    HT3: "1443103911996162128",
    LT3: "1443106593699921950",
    HT4: "1443104391254245507",
    LT4: "1443105831003619402",
    HT5: "1443104858369687603",
    LT5: "1443105388894617753"
  },
  "pot-pvp": {
    HT1: "1443099487383064606",
    LT1: "1443108703606935562",
    HT2: "1443102938326106183",
    LT2: "1443107840339349606",
    HT3: "1443103916177883249",
    LT3: "1443106589190914180",
    HT4: "1443104394290659400",
    LT4: "1443105837769035777",
    HT5: "1443104860659519488",
    LT5: "1443105393885708358"
  },
  "neth-op": {
    HT1: "1443099704132112384",
    LT1: "1443108734909026415",
    HT2: "1443102941144809484",
    LT2: "1443107836514009098",
    HT3: "1443103918685945877",
    LT3: "1443106629011771475",
    HT4: "1443104397004374066",
    LT4: "1443105834694348914",
    HT5: "1443104863541137530",
    LT5: "1443105396704149584"
  }
};

// Helper: get all tier role IDs for a given gamemode
function getGamemodeRoleIds(gamemodeId) {
  const gm = ROLE_MAP[gamemodeId];
  if (!gm) return [];
  return Object.values(gm);
}

// Helper: get the specific role ID for gamemode + tier
function getTierRoleId(gamemodeId, tierName) {
  const gm = ROLE_MAP[gamemodeId];
  if (!gm) return null;
  return gm[tierName] || null;
}

// =========================
// PERMISSIONS
// =========================

// 👇 PUT YOUR STAFF ROLE IDS HERE
const STAFF_ROLE_IDS = [
  "1348444228811755621",
  "1348444272302755931"
];

function userHasPermission(interaction) {
  // Admins always allowed
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  const roles = interaction.member?.roles;
  if (!roles || !roles.cache) return false;

  return STAFF_ROLE_IDS.some(id => roles.cache.has(id));
}

// =========================
// DISCORD CLIENT
// =========================

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
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
        .setDescription("Player's Minecraft IGN")
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("gamemode")
        .setDescription("Gamemode ID (vanilla-pvp, mace-pvp, etc.)")
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("tier")
        .setDescription("Tier (HT1, LT1, ... HT5, LT5)")
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName("discord_user")
        .setDescription("Discord user to assign roles to")
        .setRequired(true)
    ),

  // /removetier
  new SlashCommandBuilder()
    .setName("removetier")
    .setDescription("Remove a player from all tiers in a gamemode.")
    .addStringOption(opt =>
      opt.setName("player")
        .setDescription("Player's Minecraft IGN")
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("gamemode")
        .setDescription("Gamemode ID (vanilla-pvp, mace-pvp, etc.)")
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName("discord_user")
        .setDescription("Discord user to remove tier roles from")
        .setRequired(true)
    ),

  // /result
  new SlashCommandBuilder()
    .setName("result")
    .setDescription("Post a public test result for a player.")
    .addStringOption(opt =>
      opt.setName("player")
        .setDescription("Player's Minecraft IGN")
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("gamemode")
        .setDescription("Gamemode ID (vanilla-pvp, mace-pvp, etc.)")
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
// LOG HELPERS
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
// ROLE APPLY HELPERS
// =========================

async function applyTierRoles(member, gamemodeId, tierName) {
  const allRoleIds = getGamemodeRoleIds(gamemodeId);
  if (allRoleIds.length === 0) return; // no config for this gamemode

  const targetRoleId = getTierRoleId(gamemodeId, tierName);
  if (!targetRoleId) return; // no specific role for this tier

  try {
    // Remove all tier roles for this gamemode except the one we're setting
    const rolesToRemove = allRoleIds.filter(id => id !== targetRoleId && member.roles.cache.has(id));
    if (rolesToRemove.length > 0) {
      await member.roles.remove(rolesToRemove);
    }

    // Add the new tier role if they don't have it
    if (!member.roles.cache.has(targetRoleId)) {
      await member.roles.add(targetRoleId);
    }
  } catch (err) {
    console.error(`Failed to update roles for ${member.user.tag}`, err);
  }
}

async function clearTierRoles(member, gamemodeId) {
  const allRoleIds = getGamemodeRoleIds(gamemodeId);
  if (allRoleIds.length === 0) return;

  try {
    const rolesToRemove = allRoleIds.filter(id => member.roles.cache.has(id));
    if (rolesToRemove.length > 0) {
      await member.roles.remove(rolesToRemove);
    }
  } catch (err) {
    console.error(`Failed to clear roles for ${member.user.tag}`, err);
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

  // Permissions gate
  if (!userHasPermission(interaction)) {
    return interaction.reply({
      content: "❌ You do not have permission to use this command.",
      ephemeral: true
    });
  }

  const command = interaction.commandName;

  // -------------------------
  // /settier
  // -------------------------
  if (command === "settier") {
    const player = interaction.options.getString("player");
    const gamemodeId = interaction.options.getString("gamemode");
    const tierName = interaction.options.getString("tier");
    const discordUser = interaction.options.getUser("discord_user");

    await interaction.deferReply({ flags: 64 });

    const moderatorTag = interaction.user.tag;
    const moderatorId = interaction.user.id;
    const now = new Date();
    const nowIso = now.toISOString();

    // Fetch member for role updates
    let member = null;
    try {
      member = await interaction.guild.members.fetch(discordUser.id);
    } catch {
      // ignore, will just skip role part if we can't find member
    }

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

      // Apply Discord roles if we have the member & config
      if (member) {
        await applyTierRoles(member, gamemodeId, tierName);
      }

      const embed = new EmbedBuilder()
        .setColor(0x4caf50)
        .setTitle("Tier Updated")
        .addFields(
          { name: "Moderator", value: `<@${moderatorId}>`, inline: true },
          { name: "Player (IGN)", value: `\`${player}\``, inline: true },
          { name: "Discord User", value: `<@${discordUser.id}>`, inline: true },
          { name: "Gamemode", value: `\`${gamemodeId}\``, inline: true },
          { name: "New Tier", value: `\`${tierName}\``, inline: true }
        )
        .setTimestamp(now);

      await sendEmbedToChannel(LOG_CHANNEL_ID, embed);

      await interaction.editReply(
        `✅ Set **${player}** to **${tierName}** in **${gamemodeId}** for <@${discordUser.id}>`
      );
    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Error talking to the API or updating roles.");
    }
  }

  // -------------------------
  // /removetier
  // -------------------------
  if (command === "removetier") {
    const player = interaction.options.getString("player");
    const gamemodeId = interaction.options.getString("gamemode");
    const discordUser = interaction.options.getUser("discord_user");

    await interaction.deferReply({ flags: 64 });

    const moderatorTag = interaction.user.tag;
    const moderatorId = interaction.user.id;
    const now = new Date();
    const nowIso = now.toISOString();

    let member = null;
    try {
      member = await interaction.guild.members.fetch(discordUser.id);
    } catch {
      // ignore
    }

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

      // Clear gamemode tier roles from the member
      if (member) {
        await clearTierRoles(member, gamemodeId);
      }

      const embed = new EmbedBuilder()
        .setColor(0xf44336)
        .setTitle("Tier Removed")
        .addFields(
          { name: "Moderator", value: `<@${moderatorId}>`, inline: true },
          { name: "Player (IGN)", value: `\`${player}\``, inline: true },
          { name: "Discord User", value: `<@${discordUser.id}>`, inline: true },
          { name: "Gamemode", value: `\`${gamemodeId}\``, inline: true },
          { name: "Removed Entries", value: `\`${removed}\``, inline: true }
        )
        .setTimestamp(now);

      await sendEmbedToChannel(LOG_CHANNEL_ID, embed);

      if (removed > 0) {
        await interaction.editReply(
          `✅ Removed **${player}** from **${gamemodeId}** and cleared tier roles for <@${discordUser.id}>.`
        );
      } else {
        await interaction.editReply(
          `ℹ️ **${player}** was not found in any tier for **${gamemodeId}**, but tier roles were cleared for <@${discordUser.id}>.`
        );
      }
    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Error talking to the API or updating roles.");
    }
  }

  // -------------------------
  // /result
  // -------------------------
  if (command === "result") {
    const player = interaction.options.getString("player");
    const gamemodeId = interaction.options.getString("gamemode");
    const tierName = interaction.options.getString("tier");

    await interaction.deferReply({ flags: 64 });

    const testerTag = interaction.user.tag;
    const testerId = interaction.user.id;
    const now = new Date();
    const prettyDate = now.toLocaleString();

    const embed = new EmbedBuilder()
      .setColor(0x2196f3)
      .setTitle("Tier Test Result")
      .setDescription(`Manual test result submitted by <@${testerId}>`)
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
// RENDER PING SERVER
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
