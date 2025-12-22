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
  const s = status.toLowerCase().trim();

  // Check for emojis first (from data.md format)
  if (s.includes('✅') || s.includes('undetect') || s.includes('undetected') || s.includes('safe'))
    return { emoji: '✅', color: Colors.Green };

  if (s.includes('🛠️') || s.includes('on-update') || s.includes('on update') || s.includes('maintenance') || s.includes('updating') || s.includes('update'))
    return { emoji: '🛠️', color: Colors.Blue };

  if (s.includes('❌') || s.includes('closed') || s.includes('detected'))
    return { emoji: '❌', color: Colors.Red };

  if (s.includes('⚠️') || s.includes('risk'))
    return { emoji: '⚠️', color: Colors.Yellow };

  return { emoji: '⚪', color: Colors.Grey }; // Default for unknown
};

// --- SCRAPER FUNCTION ---
const scrapeStatus = async (): Promise<GameGroup[]> => {
  try {
    console.log(`[${new Date().toISOString()}] Scraping ${CONFIG.URL}...`);

    // Anti-Blocking Strategy: Real browser headers to bypass Cloudflare/WAF
    const { data } = await axios.get(CONFIG.URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://indohax.net/',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      },
      timeout: 15000 // 15 seconds timeout
    });

    const $ = cheerio.load(data);
    const gamesMap = new Map<string, Array<{ name: string; status: string }>>();

    // The website uses a structured layout with:
    // .pstat-game-section -> contains game name in data-game attribute
    // .pstat-product-item -> individual product
    // .pstat-product-name -> product name (format: "Product : Game")
    // .pstat-product-status -> status div with class like "pstat-status-undetect"

    $('.pstat-game-section').each((_, gameSection) => {
      const $section = $(gameSection);
      const gameName = $section.data('game') as string;

      if (!gameName) return;

      // Initialize products array for this game
      if (!gamesMap.has(gameName)) {
        gamesMap.set(gameName, []);
      }

      // Find all products in this game section
      $section.find('.pstat-product-item').each((_, productItem) => {
        const $product = $(productItem);

        // Extract product name
        const productNameEl = $product.find('.pstat-product-name').first();
        const productText = productNameEl.text().trim();

        // Extract status from the status div
        const statusEl = $product.find('.pstat-product-status').first();
        const statusClass = statusEl.attr('class') || '';

        // Determine status from class name
        let status = 'Unknown';
        if (statusClass.includes('pstat-status-undetect')) status = 'Undetect';
        else if (statusClass.includes('pstat-status-updating')) status = 'On-Update';
        else if (statusClass.includes('pstat-status-risk')) status = 'Risk';
        else if (statusClass.includes('pstat-status-closed')) status = 'Closed';

        // Clean product name (remove ": Game" part)
        const match = productText.match(/^(.+?)\s*:\s*.+$/);
        const cleanProductName = match ? match[1].trim() : productText;

        if (cleanProductName) {
          gamesMap.get(gameName)!.push({
            name: cleanProductName,
            status: status
          });
        }
      });
    });

    // Convert Map to array
    const gameGroups: GameGroup[] = [];
    gamesMap.forEach((products, gameName) => {
      gameGroups.push({
        gameName: gameName,
        products: products
      });
    });

    // Sort game groups alphabetically
    gameGroups.sort((a, b) => a.gameName.localeCompare(b.gameName));

    // Debug: If no data found, log HTML snippet
    if (gameGroups.length === 0) {
      console.error('❌ No data found! Debug HTML snippet:');
      console.log($.html().substring(0, 1000));
    } else {
      const totalProducts = gameGroups.reduce((acc, g) => acc + g.products.length, 0);
      console.log(`✅ Successfully scraped ${gameGroups.length} games with ${totalProducts} products`);
    }

    return gameGroups;
  } catch (error) {
    console.error('❌ Error scraping data:', error);
    return [];
  }
};

// --- EMBED BUILDER ---
const generateEmbeds = (gameGroups: GameGroup[]) => {
  const embeds: EmbedBuilder[] = [];
  const GAMES_PER_EMBED = 25; // Discord limits to 25 fields per embed

  // Calculate overall statistics
  const totalProducts = gameGroups.reduce((acc, g) => acc + g.products.length, 0);
  const statusCounts = {
    undetect: 0,
    updating: 0,
    risk: 0,
    closed: 0
  };

  gameGroups.forEach(game => {
    game.products.forEach(product => {
      const s = product.status.toLowerCase();
      if (s.includes('undetect')) statusCounts.undetect++;
      else if (s.includes('update')) statusCounts.updating++;
      else if (s.includes('risk')) statusCounts.risk++;
      else if (s.includes('closed')) statusCounts.closed++;
    });
  });

  // Determine embed color based on overall health
  const getEmbedColor = () => {
    const total = statusCounts.undetect + statusCounts.updating + statusCounts.risk + statusCounts.closed;
    const undetectPercentage = total > 0 ? (statusCounts.undetect / total) * 100 : 0;

    if (undetectPercentage >= 80) return Colors.Green; // Mostly healthy
    if (undetectPercentage >= 50) return Colors.Blue;  // Mixed
    if (statusCounts.closed > statusCounts.undetect) return Colors.Red; // Mostly down
    return Colors.Gold; // Warning state
  };

  // Split games into chunks of 25
  for (let i = 0; i < gameGroups.length; i += GAMES_PER_EMBED) {
    const chunk = gameGroups.slice(i, i + GAMES_PER_EMBED);
    const pageNum = Math.floor(i / GAMES_PER_EMBED) + 1;
    const totalPages = Math.ceil(gameGroups.length / GAMES_PER_EMBED);

    // Create description with stats
    const description = [
      '```',
      '┌─────────────────────────────────────┐',
      '│    🛡️ INDOHAX STATUS MONITOR        │',
      '│    Live Cheat Status Tracker        │',
      '└─────────────────────────────────────┘',
      '```',
      '',
      '**📊 Overall Status:**',
      `✅ **Undetect:** ${statusCounts.undetect} │ `,
      `🛠️ **Updating:** ${statusCounts.updating} │ `,
      `⚠️ **Risk:** ${statusCounts.risk} │ `,
      `❌ **Closed:** ${statusCounts.closed}`,
      '',
      `**🎮 Monitoring:** ${totalProducts} products across ${gameGroups.length} games`,
      `**🔄 Auto-refresh:** Every 5 minutes`,
      ''
    ].join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`🎮 Cheat Status Monitor${totalPages > 1 ? ` ── Page ${pageNum}/${totalPages}` : ''}`)
      .setDescription(description)
      .setURL(CONFIG.URL)
      .setTimestamp()
      .setColor(getEmbedColor())
      .setAuthor({
        name: '🛡️ INDOHAX Status Tracker',
        url: CONFIG.URL
      })
      .setFooter({
        text: `🕐 ${new Date().toLocaleString('en-US', {
          timeZone: 'UTC',
          hour12: false,
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })} UTC  •  Auto-refresh every 5min`
      });

    // Add games as fields with better formatting
    chunk.forEach((gameGroup, index) => {
      // Group products by status for better visual
      const productsByStatus: { [key: string]: string[] } = {
        Undetect: [],
        'On-Update': [],
        Risk: [],
        Closed: []
      };

      gameGroup.products.forEach(product => {
        const statusKey = product.status === 'Undetect' ? 'Undetect' :
                         product.status === 'On-Update' ? 'On-Update' :
                         product.status === 'Risk' ? 'Risk' : 'Closed';
        productsByStatus[statusKey].push(product.name);
      });

      // Build field value with status grouping
      const fieldValueParts: string[] = [];

      if (productsByStatus.Undetect.length > 0) {
        fieldValueParts.push(`**✅ UNDETECT**\n${productsByStatus.Undetect.map(p => `├─ ${p}`).join('\n')}`);
      }
      if (productsByStatus['On-Update'].length > 0) {
        fieldValueParts.push(`**🛠️ UPDATING**\n${productsByStatus['On-Update'].map(p => `├─ ${p}`).join('\n')}`);
      }
      if (productsByStatus.Risk.length > 0) {
        fieldValueParts.push(`**⚠️ RISK**\n${productsByStatus.Risk.map(p => `├─ ${p}`).join('\n')}`);
      }
      if (productsByStatus.Closed.length > 0) {
        fieldValueParts.push(`**❌ CLOSED**\n${productsByStatus.Closed.map(p => `├─ ${p}`).join('\n')}`);
      }

      const fieldValue = fieldValueParts.length > 0
        ? fieldValueParts.join('\n\n')
        : '`No products available`';

      // Add field with better formatting
      embed.addFields({
        name: `${index + 1}. **${gameGroup.gameName}**`,
        value: fieldValue,
        inline: false // Better readability
      });
    });

    embeds.push(embed);
  }

  return embeds;
};

// --- MAIN UPDATE LOGIC ---
const updateStatusMessage = async () => {
  console.log(`\n[${new Date().toISOString()}] 🔄 Starting update cycle...`);
  const data = await scrapeStatus();

  if (data.length === 0) {
    console.log('⚠️ No data found or scraping failed. Will retry in 5 minutes.');
    return;
  }

  const embeds = generateEmbeds(data);
  const channel = await client.channels.fetch(CONFIG.CHANNEL_ID) as TextChannel;

  if (!channel) {
    console.error('❌ Channel not found! Check your CHANNEL_ID in .env');
    return;
  }

  try {
    // Scenario A: We have stored Message IDs, let's try to edit them
    if (activeMessageIds.length > 0) {
      // Check if embed count matches message count
      if (activeMessageIds.length === embeds.length) {
        console.log(`📝 Editing ${activeMessageIds.length} existing messages...`);
        for (let i = 0; i < activeMessageIds.length; i++) {
          try {
            const msg = await channel.messages.fetch(activeMessageIds[i]);
            if (msg) await msg.edit({ embeds: [embeds[i]] });
          } catch (e) {
            console.error(`❌ Failed to edit message ${activeMessageIds[i]}:`, e);
            throw e; // Re-throw to trigger recreate
          }
        }
        console.log('✅ Messages updated successfully!');
        return;
      } else {
        // If the number of pages changed (e.g. new games added), delete old and resend
        console.log(`🔄 Page count changed (${activeMessageIds.length} → ${embeds.length}), recreating messages...`);
        for (const id of activeMessageIds) {
          try {
            const msg = await channel.messages.fetch(id);
            if (msg) await msg.delete();
          } catch (e) {
            console.log(`⚠️ Could not delete old message ${id}, continuing...`);
          }
        }
        activeMessageIds = []; // Reset
      }
    }

    // Scenario B: No messages exist (or we just reset), send new ones
    if (activeMessageIds.length === 0) {
      console.log(`📤 Sending ${embeds.length} new message(s)...`);
      for (const embed of embeds) {
        const msg = await channel.send({ embeds: [embed] });
        activeMessageIds.push(msg.id);
      }
      console.log(`✅ Successfully sent ${activeMessageIds.length} message(s)!`);
    }

  } catch (error) {
    console.error('❌ Error sending/editing messages:', error);
    // If critical error (e.g., message deleted manually), clear IDs to resend next time
    activeMessageIds = [];
  }
};

// --- INITIALIZATION ---
client.once('ready', () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Bot successfully logged in as ${client.user?.tag}`);
  console.log(`📍 Target Channel: ${CONFIG.CHANNEL_ID}`);
  console.log(`🌐 Target URL: ${CONFIG.URL}`);
  console.log(`⏰ Refresh Rate: ${CONFIG.REFRESH_RATE / 60000} minutes`);
  console.log(`${'='.repeat(50)}\n`);

  // Run immediately on start
  updateStatusMessage();

  // Set interval
  setInterval(updateStatusMessage, CONFIG.REFRESH_RATE);
});

client.login(CONFIG.TOKEN);
