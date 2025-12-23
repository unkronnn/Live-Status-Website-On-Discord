import {
  Client,
  GatewayIntentBits,
  TextChannel,
  EmbedBuilder,
  Colors,
  Message,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
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

// Global state
let activeMessageId: string | null = null;
let currentPage = 1;
let totalPages = 1;
let allGameGroups: GameGroup[] = [];

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

// --- EMBED BUILDER (Single Page) ---
const generateEmbed = (gameGroups: GameGroup[], page: number) => {
  const GAMES_PER_PAGE = 20; // Reduced for cleaner look
  const totalPages = Math.ceil(gameGroups.length / GAMES_PER_PAGE);

  // Calculate overall statistics (from ALL games, not just current page)
  const totalProducts = gameGroups.reduce((acc, g) => acc + g.products.length, 0);
  const statusCounts = { undetect: 0, updating: 0, risk: 0, closed: 0 };

  gameGroups.forEach(game => {
    game.products.forEach(product => {
      const s = product.status.toLowerCase();
      if (s.includes('undetect')) statusCounts.undetect++;
      else if (s.includes('update')) statusCounts.updating++;
      else if (s.includes('risk')) statusCounts.risk++;
      else if (s.includes('closed')) statusCounts.closed++;
    });
  });

  // Determine embed color
  const total = statusCounts.undetect + statusCounts.updating + statusCounts.risk + statusCounts.closed;
  const undetectPercentage = total > 0 ? (statusCounts.undetect / total) * 100 : 0;

  const getEmbedColor = () => {
    if (undetectPercentage >= 80) return Colors.Green;
    if (undetectPercentage >= 50) return Colors.Blue;
    if (statusCounts.closed > statusCounts.undetect) return Colors.Red;
    return Colors.Gold;
  };

  // Get games for current page
  const startIndex = (page - 1) * GAMES_PER_PAGE;
  const endIndex = startIndex + GAMES_PER_PAGE;
  const pageGames = gameGroups.slice(startIndex, endIndex);

  // Create clean description
  const description = [
    '>>> ',
    `**📊 Status:** ${statusCounts.undetect}✅  ${statusCounts.updating}🛠️  ${statusCounts.risk}⚠️  ${statusCounts.closed}❌`,
    `\n**🎮 Total:** ${totalProducts} products • ${gameGroups.length} games`,
    `**🔄 Updates:** Every 5 min`
  ].join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`🛡️ INDOHAX Status Monitor ${totalPages > 1 ? `│ Page ${page}/${totalPages}` : ''}`)
    .setDescription(description)
    .setURL(CONFIG.URL)
    .setTimestamp()
    .setColor(getEmbedColor())
    .setFooter({
      text: `🕐 ${new Date().toLocaleString('en-US', {
        timeZone: 'UTC',
        hour12: false,
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })} UTC`
    });

  // Add games as fields
  pageGames.forEach((gameGroup) => {
    const productItems = gameGroup.products.map(product => {
      const emoji = product.status === 'Undetect' ? '✅' :
                   product.status === 'On-Update' ? '🛠️' :
                   product.status === 'Risk' ? '⚠️' : '❌';
      return `${emoji} ${product.name}`;
    });

    const fieldValue = productItems.length > 0
      ? productItems.join(' • ')
      : '`No products`';

    embed.addFields({
      name: gameGroup.gameName,
      value: fieldValue,
      inline: false
    });
  });

  return { embed, totalPages };
};

// --- CREATE BUTTON ROW ---
const createButtonRow = (page: number, totalPages: number) => {
  const row = new ActionRowBuilder<ButtonBuilder>();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('first')
      .setLabel('⏮ First')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 1),
    new ButtonBuilder()
      .setCustomId('prev')
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === 1),
    new ButtonBuilder()
      .setCustomId('next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === totalPages),
    new ButtonBuilder()
      .setCustomId('last')
      .setLabel('⏭ Last')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === totalPages),
    new ButtonBuilder()
      .setCustomId('refresh')
      .setLabel('🔄 Refresh')
      .setStyle(ButtonStyle.Success)
  );

  return row;
};

// --- MAIN UPDATE LOGIC ---
const updateStatusMessage = async (isNewMessage = false) => {
  console.log(`\n[${new Date().toISOString()}] 🔄 Starting update cycle...`);
  const data = await scrapeStatus();

  if (data.length === 0) {
    console.log('⚠️ No data found or scraping failed. Will retry in 5 minutes.');
    return;
  }

  // Store all game groups globally
  allGameGroups = data;

  const channel = await client.channels.fetch(CONFIG.CHANNEL_ID) as TextChannel;

  if (!channel) {
    console.error('❌ Channel not found! Check your CHANNEL_ID in .env');
    return;
  }

  try {
    const { embed, totalPages: newTotalPages } = generateEmbed(allGameGroups, currentPage);
    totalPages = newTotalPages;

    const components = createButtonRow(currentPage, totalPages);

    // Reset to page 1 if out of bounds
    if (currentPage > totalPages) {
      currentPage = 1;
      await updateStatusMessage(isNewMessage);
      return;
    }

    if (activeMessageId && !isNewMessage) {
      // Edit existing message
      const msg = await channel.messages.fetch(activeMessageId);
      if (msg) {
        await msg.edit({
          embeds: [embed],
          components: [components]
        });
        console.log(`✅ Message updated! (Page ${currentPage}/${totalPages})`);
      }
    } else {
      // Send new message
      if (activeMessageId) {
        try {
          const oldMsg = await channel.messages.fetch(activeMessageId);
          if (oldMsg) await oldMsg.delete();
        } catch (e) {
          console.log('⚠️ Could not delete old message');
        }
      }

      const msg = await channel.send({
        embeds: [embed],
        components: [components]
      });
      activeMessageId = msg.id;
      console.log(`✅ New message sent! (Page ${currentPage}/${totalPages})`);
    }

    // Setup button collector
    setupButtonCollector(channel);

  } catch (error) {
    console.error('❌ Error sending/editing message:', error);
    activeMessageId = null;
  }
};

// --- BUTTON COLLECTOR ---
const setupButtonCollector = (channel: TextChannel) => {
  if (!activeMessageId) return;

  // Create collector for button interactions
  const filter = (i: any) => i.user.id === client.user?.id || i.message.id === activeMessageId;
  const collector = channel.createMessageComponentCollector({
    filter,
    componentType: ComponentType.Button,
    time: 5 * 60 * 1000 // 5 minutes
  });

  collector.on('collect', async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId } = interaction;

    if (customId === 'first') currentPage = 1;
    else if (customId === 'prev') currentPage = Math.max(1, currentPage - 1);
    else if (customId === 'next') currentPage = Math.min(totalPages, currentPage + 1);
    else if (customId === 'last') currentPage = totalPages;
    else if (customId === 'refresh') {
      // Force refresh data
      await interaction.update({ content: '🔄 Refreshing data...', embeds: [], components: [] });
      await scrapeStatus().then(data => {
        allGameGroups = data;
      });
      currentPage = 1;
      await updateStatusMessage(false);
      return;
    }

    // Update embed
    const { embed } = generateEmbed(allGameGroups, currentPage);
    const components = createButtonRow(currentPage, totalPages);

    await interaction.update({
      embeds: [embed],
      components: [components]
    });

    // Reset collector timer
    collector.resetTimer();
  });

  collector.on('end', async () => {
    console.log('⏰ Button collector expired, refreshing...');
    // Auto-refresh after 5 minutes
    currentPage = 1;
    await updateStatusMessage(false);
  });
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
