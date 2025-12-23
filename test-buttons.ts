import axios from 'axios';
import * as cheerio from 'cheerio';

const CONFIG = {
  URL: 'https://indohax.net/status',
};

interface GameGroup {
  gameName: string;
  products: Array<{
    name: string;
    status: string;
  }>;
}

// Copy scraper
const scrapeStatus = async (): Promise<GameGroup[]> => {
  try {
    const { data } = await axios.get(CONFIG.URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://indohax.net/',
      },
      timeout: 15000
    });

    const $ = cheerio.load(data);
    const gamesMap = new Map<string, Array<{ name: string; status: string }>>();

    $('.pstat-game-section').each((_, gameSection) => {
      const $section = $(gameSection);
      const gameName = $section.data('game') as string;

      if (!gameName) return;

      if (!gamesMap.has(gameName)) {
        gamesMap.set(gameName, []);
      }

      $section.find('.pstat-product-item').each((_, productItem) => {
        const $product = $(productItem);

        const productNameEl = $product.find('.pstat-product-name').first();
        const productText = productNameEl.text().trim();

        const statusEl = $product.find('.pstat-product-status').first();
        const statusClass = statusEl.attr('class') || '';

        let status = 'Unknown';
        if (statusClass.includes('pstat-status-undetect')) status = 'Undetect';
        else if (statusClass.includes('pstat-status-updating')) status = 'On-Update';
        else if (statusClass.includes('pstat-status-risk')) status = 'Risk';
        else if (statusClass.includes('pstat-status-closed')) status = 'Closed';

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

    const gameGroups: GameGroup[] = [];
    gamesMap.forEach((products, gameName) => {
      gameGroups.push({
        gameName: gameName,
        products: products
      });
    });

    gameGroups.sort((a, b) => a.gameName.localeCompare(b.gameName));

    return gameGroups;
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
};

// Test UI
const testUI = async () => {
  console.log('Fetching data...\n');
  const gameGroups = await scrapeStatus();

  if (gameGroups.length === 0) {
    console.log('❌ No data found');
    return;
  }

  console.log(`✅ Found ${gameGroups.length} games\n`);

  const page = 1;
  const GAMES_PER_PAGE = 20;

  // Calculate stats
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

  const totalPages = Math.ceil(gameGroups.length / GAMES_PER_PAGE);
  const startIndex = (page - 1) * GAMES_PER_PAGE;
  const endIndex = startIndex + GAMES_PER_PAGE;
  const pageGames = gameGroups.slice(startIndex, endIndex);

  console.log('='.repeat(70));
  console.log('📋 NEW UI PREVIEW - With Button Navigation');
  console.log('='.repeat(70));
  console.log('');

  // Title
  console.log(`🛡️ INDOHAX Status Monitor │ Page ${page}/${totalPages}`);
  console.log('');

  // Description
  console.log(`>>>`);
  console.log(`**📊 Status:** ${statusCounts.undetect}✅  ${statusCounts.updating}🛠️  ${statusCounts.risk}⚠️  ${statusCounts.closed}❌`);
  console.log(``);
  console.log(`**🎮 Total:** ${totalProducts} products • ${gameGroups.length} games`);
  console.log(`**🔄 Updates:** Every 5 min`);
  console.log('');

  // Fields
  console.log('─'.repeat(70));
  console.log('');

  pageGames.forEach((gameGroup) => {
    const productItems = gameGroup.products.map(product => {
      const emoji = product.status === 'Undetect' ? '✅' :
                   product.status === 'On-Update' ? '🛠️' :
                   product.status === 'Risk' ? '⚠️' : '❌';
      return `${emoji} ${product.name}`;
    });

    const fieldValue = productItems.length > 0
      ? productItems.join(' • ')
      : 'No products';

    console.log(`**${gameGroup.gameName}**`);
    console.log(fieldValue);
    console.log('');
    console.log('─'.repeat(70));
    console.log('');
  });

  // Buttons
  console.log('🔘 BUTTONS:');
  console.log('  ⏮ First  ◀ Prev  [Next ▶]  ⏭ Last  🔄 Refresh');
  console.log('');
  console.log('  (Current buttons state - Disabled: First, Prev | Active: Next, Last, Refresh)');
  console.log('');

  // Footer
  const now = new Date();
  const utcTime = now.toLocaleString('en-US', {
    timeZone: 'UTC',
    hour12: false,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  console.log(`🕐 ${utcTime} UTC`);
  console.log('');

  console.log('='.repeat(70));
  console.log('✨ NEW FEATURES:');
  console.log('='.repeat(70));
  console.log('✅ Single message with pagination buttons');
  console.log('✅ Cleaner description with inline stats');
  console.log('✅ 20 games per page (more compact)');
  console.log('✅ Navigation: First, Previous, Next, Last, Refresh');
  console.log('✅ Auto-refresh every 5 minutes');
  console.log('✅ Buttons auto-disable at boundaries');
  console.log('='.repeat(70));
};

testUI().catch(console.error);
