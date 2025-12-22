import {
  Client,
  GatewayIntentBits,
  TextChannel,
  EmbedBuilder,
  Colors,
  Message
} from 'discord.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const CONFIG = {
  TOKEN: process.env.DISCORD_TOKEN,
  CHANNEL_ID: process.env.CHANNEL_ID || '',
  URL: process.env.TARGET_URL || 'https://indohax.net/status',
  REFRESH_RATE: 5 * 60 * 1000, // 5 Minutes
};

interface GameGroup {
  gameName: string;
  products: Array<{
    name: string;
    status: string;
  }>;
}

// Global variable to store Message IDs to edit them later
let activeMessageIds: string[] = [];

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// --- HELPER: Get Emoji & Color based on Status ---
const getStatusFormatting = (status: string) => {
  const s = status.toLowerCase();

  // "Undetect" → 🟢 Green
  if (s.includes('undetect') || s.includes('undetected'))
    return { emoji: '🟢', color: Colors.Green };

  // "On-Update" or "Maintenance" → 🛠️ Blue/Orange
  if (s.includes('on-update') || s.includes('on update') || s.includes('maintenance') || s.includes('updating'))
    return { emoji: '🛠️', color: Colors.Blue };

  // "Closed" or "Detected" → ❌ Red
  if (s.includes('closed') || s.includes('detected'))
    return { emoji: '❌', color: Colors.Red };

  // "Risk" → ⚠️ Yellow
  if (s.includes('risk'))
    return { emoji: '⚠️', color: Colors.Yellow };

  return { emoji: '⚪', color: Colors.Grey }; // Default
};

// --- SCRAPER FUNCTION ---
const scrapeStatus = async (): Promise<GameGroup[]> => {
  try {
    const { data } = await axios.get(CONFIG.URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const $ = cheerio.load(data);
    const gameGroups: GameGroup[] = [];
    let currentGame = '';
    let currentProducts: Array<{ name: string; status: string }> = [];

    // Logic to traverse hierarchical structure: Game Name (Header) -> Products (Items)
    // This handles HTML with headers for games and list items/rows for products
    $('table tbody tr').each((_, el) => {
      const $el = $(el);

      // Check if this is a game header row (usually has different styling or colspan)
      const isHeader = $el.find('td[colspan], th').length > 0;

      if (isHeader) {
        // Save previous game group if exists
        if (currentGame && currentProducts.length > 0) {
          gameGroups.push({
            gameName: currentGame,
            products: [...currentProducts]
          });
        }

        // Start new game group
        currentGame = $el.text().trim();
        currentProducts = [];
      } else {
        // This is a product row
        const tds = $el.find('td');
        if (tds.length >= 2) {
          const productName = $(tds[0]).text().trim();
          const status = $(tds[1]).text().trim();

          if (productName && status) {
            currentProducts.push({ name: productName, status });
          }
        }
      }
    });

    // Don't forget the last game group
    if (currentGame && currentProducts.length > 0) {
      gameGroups.push({
        gameName: currentGame,
        products: currentProducts
      });
    }

    // Alternative: If the site uses a standard table structure without headers,
    // we group by the first column (Game Name)
    if (gameGroups.length === 0) {
      const gamesMap = new Map<string, Array<{ name: string; status: string }>>();

      $('table tbody tr').each((_, el) => {
        const tds = $(el).find('td');
        if (tds.length >= 3) {
          const gameName = $(tds[0]).text().trim();
          const productName = $(tds[1]).text().trim();
          const status = $(tds[2]).text().trim();

          if (gameName && productName) {
            if (!gamesMap.has(gameName)) {
              gamesMap.set(gameName, []);
            }
            gamesMap.get(gameName)!.push({ name: productName, status });
          }
        }
      });

      // Convert Map to array of GameGroup
      gamesMap.forEach((products, gameName) => {
        gameGroups.push({ gameName, products });
      });
    }

    return gameGroups;
  } catch (error) {
    console.error('Error scraping data:', error);
    return [];
  }
};

// --- EMBED BUILDER ---
const generateEmbeds = (gameGroups: GameGroup[]) => {
  const embeds: EmbedBuilder[] = [];
  const GAMES_PER_EMBED = 25; // Discord limits to 25 fields per embed

  // Split games into chunks of 25
  for (let i = 0; i < gameGroups.length; i += GAMES_PER_EMBED) {
    const chunk = gameGroups.slice(i, i + GAMES_PER_EMBED);

    const embed = new EmbedBuilder()
      .setTitle(`🛡️ Indohax Status Monitor`)
      .setDescription(`Live cheat status updates. Refreshes every 5 minutes.`)
      .setURL(CONFIG.URL)
      .setTimestamp()
      .setColor(Colors.Blue); // Default blue color
      // .setFooter({ text: `Page ${Math.floor(i / GAMES_PER_EMBED) + 1}/${Math.ceil(gameGroups.length / GAMES_PER_EMBED)} • Auto-refreshing` });

    // Add each game as a field with all products listed
    chunk.forEach(gameGroup => {
      const fieldValue = gameGroup.products
        .map(product => {
          const { emoji } = getStatusFormatting(product.status);
          return `${emoji} ${product.name}`;
        })
        .join('\n');

      embed.addFields({
        name: `**${gameGroup.gameName}**`,
        value: fieldValue || 'No products available',
        inline: true // Use inline to fit multiple games side-by-side
      });
    });

    embeds.push(embed);
  }

  return embeds;
};

// --- MAIN UPDATE LOGIC ---
const updateStatusMessage = async () => {
  console.log(`[${new Date().toISOString()}] Fetching data...`);
  const data = await scrapeStatus();

  if (data.length === 0) {
    console.log('No data found or scraping failed.');
    return;
  }

  const embeds = generateEmbeds(data);
  const channel = await client.channels.fetch(CONFIG.CHANNEL_ID) as TextChannel;

  if (!channel) {
    console.error('Channel not found!');
    return;
  }

  try {
    // Scenario A: We have stored Message IDs, let's try to edit them
    if (activeMessageIds.length > 0) {
      // Check if embed count matches message count
      if (activeMessageIds.length === embeds.length) {
        for (let i = 0; i < activeMessageIds.length; i++) {
          const msg = await channel.messages.fetch(activeMessageIds[i]);
          if (msg) await msg.edit({ embeds: [embeds[i]] });
        }
        console.log('Messages updated.');
        return;
      } else {
        // If the number of pages changed (e.g. new games added), delete old and resend
        console.log('Page count changed, recreating messages...');
        for (const id of activeMessageIds) {
          try {
            const msg = await channel.messages.fetch(id);
            if (msg) await msg.delete();
          } catch (e) { /* ignore if already deleted */ }
        }
        activeMessageIds = []; // Reset
      }
    }

    // Scenario B: No messages exist (or we just reset), send new ones
    if (activeMessageIds.length === 0) {
      // Optional: Bulk delete previous bot messages to clean channel on restart
      // await channel.bulkDelete(10);

      for (const embed of embeds) {
        const msg = await channel.send({ embeds: [embed] });
        activeMessageIds.push(msg.id);
      }
      console.log(`Sent ${activeMessageIds.length} new messages.`);
    }

  } catch (error) {
    console.error('Error sending/editing messages:', error);
    // If critical error (e.g., message deleted manually), clear IDs to resend next time
    activeMessageIds = [];
  }
};

// --- INITIALIZATION ---
client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}`);

  // Run immediately on start
  updateStatusMessage();

  // Set interval
  setInterval(updateStatusMessage, CONFIG.REFRESH_RATE);
});

client.login(CONFIG.TOKEN);
