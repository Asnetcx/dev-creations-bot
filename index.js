const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
  AttachmentBuilder
} = require("discord.js");

const fs = require("fs");
const OpenAI = require("openai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY
});

const defaultPrefix = ".";
let prefixes = {};
let economy = {};
let activeAI = new Set();
let claimedTickets = {};

const TRANSCRIPT_CHANNEL = "1475146068491632813";
const MEMBER_CHANNEL = "1474552352743624744";
const BOOST_CHANNEL = "1474552611289174106";

if (fs.existsSync("./economy.json"))
  economy = JSON.parse(fs.readFileSync("./economy.json"));

if (fs.existsSync("./prefixes.json"))
  prefixes = JSON.parse(fs.readFileSync("./prefixes.json"));

function saveEconomy() {
  fs.writeFileSync("./economy.json", JSON.stringify(economy, null, 2));
}

function savePrefixes() {
  fs.writeFileSync("./prefixes.json", JSON.stringify(prefixes, null, 2));
}

client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});


// ================= MEMBER + BOOST UPDATE =================
async function updateStats(guild) {
  const memberChannel = guild.channels.cache.get(MEMBER_CHANNEL);
  const boostChannel = guild.channels.cache.get(BOOST_CHANNEL);

  if (memberChannel)
    memberChannel.setName(`Members: ${guild.memberCount}`).catch(()=>{});

  if (boostChannel)
    boostChannel.setName(`Boosts: ${guild.premiumSubscriptionCount}`).catch(()=>{});
}

client.on("guildMemberAdd", member => updateStats(member.guild));
client.on("guildMemberRemove", member => updateStats(member.guild));
client.on("guildUpdate", guild => updateStats(guild));


// ================= MESSAGE HANDLER =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const guildId = message.guild?.id;
  const prefix = prefixes[guildId] || defaultPrefix;

  // AI inside tickets
  if (!message.content.startsWith(prefix)) {
    if (
      message.channel.name.startsWith("ticket-") &&
      activeAI.has(message.channel.id)
    ) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "You are a professional Discord support assistant." },
            { role: "user", content: message.content }
          ],
        });

        const reply = completion.choices[0].message.content;
        return message.reply(reply.slice(0, 2000));

      } catch (error) {
        console.error(error);
        return message.reply("❌ OpenAI error. Check Railway logs.");
      }
    }
    return;
  }

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ================= HELP =================
  if (command === "help") {
    return message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#2b2d31")
          .setTitle("📜 Commands")
          .setDescription(`
**Ticket**
.ticket-dashboard
.AI-Assistance
.AI-Close
.ticket-add
.ticket-remove
.close

**Moderation**
.kick
.ban
.timeout
.nickname

**Economy**
.balance
.daily
.add
.remove
.leaderboard

**Utility**
.set-prefix
.ping
`)
      ]
    });
  }

  // ================= DASHBOARD =================
  if (command === "ticket-dashboard") {
    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setImage("https://cdn.discordapp.com/attachments/1476384013026328708/1476419585363279893/IMG_4057.png")
      .setDescription(`
———————————————
**Welcome to Developer’s Portal - “Where Questions find Answers”**
We specialize in all design fields with exceptional quality and service.
———————————————
`)
      .setFooter({ text: "Select a ticket type below" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("open").setLabel("Open Ticket").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("report").setLabel("Reporting / Appeal").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("purchase").setLabel("Purchase").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("quick").setLabel("Quick Assistance").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("management").setLabel("Management").setStyle(ButtonStyle.Secondary)
    );

    embed.setImage("https://cdn.discordapp.com/attachments/1476384013026328708/1476419597442875553/IMG_4058.png");

    return message.channel.send({ embeds: [embed], components: [row] });
  }

  // ================= AI =================
  if (command === "ai-assistance") {
    if (!message.channel.name.startsWith("ticket-"))
      return message.reply("❌ Must be inside ticket.");
    activeAI.add(message.channel.id);
    return message.reply("🤖 AI Activated.");
  }

  if (command === "ai-close") {
    activeAI.delete(message.channel.id);
    return message.reply("🛑 AI Disabled.");
  }

  // ================= ECONOMY =================
  if (!economy[message.author.id]) economy[message.author.id] = 0;

  if (command === "balance") {
    const user = message.mentions.members.first() || message.member;
    if (!economy[user.id]) economy[user.id] = 0;
    return message.reply(`💰 ${user.user.tag}: ${economy[user.id]} coins`);
  }

  if (command === "daily") {
    economy[message.author.id] += 1000;
    saveEconomy();
    return message.reply("💵 +1000 coins!");
  }

  if (command === "leaderboard") {
    const sorted = Object.entries(economy)
      .sort((a,b)=>b[1]-a[1])
      .slice(0,10)
      .map((x,i)=>`${i+1}. <@${x[0]}> - ${x[1]}`);

    return message.reply({
      embeds: [new EmbedBuilder().setTitle("Leaderboard").setDescription(sorted.join("\n") || "No data.")]
    });
  }

  if (command === "add") {
    const user = message.mentions.members.first();
    const amt = parseInt(args[1]);
    if (!user || isNaN(amt)) return;
    economy[user.id] = (economy[user.id] || 0) + amt;
    saveEconomy();
    return message.reply("Added.");
  }

  if (command === "remove") {
    const user = message.mentions.members.first();
    const amt = parseInt(args[1]);
    if (!user || isNaN(amt)) return;
    economy[user.id] = (economy[user.id] || 0) - amt;
    saveEconomy();
    return message.reply("Removed.");
  }

  // ================= MODERATION =================
  if (command === "kick") {
    const user = message.mentions.members.first();
    if (user) await user.kick().catch(()=>{});
  }

  if (command === "ban") {
    const user = message.mentions.members.first();
    if (user) await user.ban().catch(()=>{});
  }

  if (command === "timeout") {
    const user = message.mentions.members.first();
    const sec = parseInt(args[1]);
    if (user && sec) await user.timeout(sec*1000).catch(()=>{});
  }

  if (command === "nickname") {
    const user = message.mentions.members.first();
    const nick = args.slice(1).join(" ");
    if (user && nick) await user.setNickname(nick).catch(()=>{});
  }

  if (command === "set-prefix") {
    prefixes[guildId] = args[0];
    savePrefixes();
    return message.reply("Prefix updated.");
  }

  if (command === "ping")
    return message.reply(`Pong: ${client.ws.ping}ms`);
});


// ================= TICKET BUTTON HANDLER =================
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  if (["open","report","purchase","quick","management"].includes(interaction.customId)) {

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close_request").setLabel("Close Request").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#2b2d31")
          .setTitle("🎫 Support Ticket")
          .setDescription("Describe your issue below.")
      ],
      components: [row]
    });

    return interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
  }

  if (interaction.customId === "claim") {
    claimedTickets[interaction.channel.id] = interaction.user.id;
    return interaction.reply("Ticket claimed.");
  }

  if (interaction.customId === "unclaim") {
    delete claimedTickets[interaction.channel.id];
    return interaction.reply("Ticket unclaimed.");
  }

  if (interaction.customId === "close") {

    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    let html = `<html><body><h2>Ticket Transcript</h2>`;
    messages.reverse().forEach(msg => {
      html += `<p><strong>${msg.author.tag}</strong>: ${msg.content}</p>`;
    });
    html += `</body></html>`;

    const filePath = `./transcript-${interaction.channel.id}.html`;
    fs.writeFileSync(filePath, html);

    const file = new AttachmentBuilder(filePath);

    const logChannel = interaction.guild.channels.cache.get(TRANSCRIPT_CHANNEL);
    if (logChannel) logChannel.send({ files: [file] });

    interaction.user.send({ files: [file] }).catch(()=>{});

    setTimeout(()=>interaction.channel.delete().catch(()=>{}), 3000);

    return interaction.reply("Closing ticket...");
  }

  if (interaction.customId === "close_request") {
    return interaction.reply("Close request sent.");
  }
});

client.login(process.env.BOT_TOKEN);
