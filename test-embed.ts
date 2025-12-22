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

// Copy of scraper
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

// Test embed generation
const testEmbed = async () => {
  console.log('Fetching data...\n');
  const gameGroups = await scrapeStatus();

  if (gameGroups.length === 0) {
    console.log('❌ No data found');
    return;
  }

  console.log(`✅ Found ${gameGroups.length} games\n`);

  // Take first 5 games for preview
  const previewGroups = gameGroups.slice(0, 5);

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

  console.log('='.repeat(60));
  console.log('📋 EMBED PREVIEW (First 5 games)');
  console.log('='.repeat(60));
  console.log('');

  // Author
  console.log('🛡️ INDOHAX Status Tracker');
  console.log('');

  // Title
  console.log('🎮 Cheat Status Monitor ── Page 1/17');
  console.log('');

  // Description
  console.log('```');
  console.log('┌─────────────────────────────────────┐');
  console.log('│    🛡️ INDOHAX STATUS MONITOR        │');
  console.log('│    Live Cheat Status Tracker        │');
  console.log('└─────────────────────────────────────┘');
  console.log('```');
  console.log('');
  console.log('**📊 Overall Status:**');
  console.log(`✅ **Undetect:** ${statusCounts.undetect} │ 🛠️ **Updating:** ${statusCounts.updating} │ ⚠️ **Risk:** ${statusCounts.risk} │ ❌ **Closed:** ${statusCounts.closed}`);
  console.log('');
  console.log(`**🎮 Monitoring:** ${totalProducts} products across ${gameGroups.length} games`);
  console.log(`**🔄 Auto-refresh:** Every 5 minutes`);
  console.log('');

  // Color indicator
  const total = statusCounts.undetect + statusCounts.updating + statusCounts.risk + statusCounts.closed;
  const undetectPercentage = total > 0 ? (statusCounts.undetect / total) * 100 : 0;

  let colorStatus = '';
  if (undetectPercentage >= 80) colorStatus = '🟢 GREEN (80%+ Undetect)';
  else if (undetectPercentage >= 50) colorStatus = '🔵 BLUE (50%+ Undetect)';
  else if (statusCounts.closed > statusCounts.undetect) colorStatus = '🔴 RED (Mostly Closed)';
  else colorStatus = '🟡 GOLD (Warning)';

  console.log(`🎨 **Embed Color:** ${colorStatus}`);
  console.log('');
  console.log('─'.repeat(60));
  console.log('');

  // Fields
  previewGroups.forEach((gameGroup, index) => {
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

    console.log(`${index + 1}. **${gameGroup.gameName}**`);
    console.log('');

    if (productsByStatus.Undetect.length > 0) {
      console.log(`**✅ UNDETECT**`);
      productsByStatus.Undetect.forEach(p => console.log(`├─ ${p}`));
    }
    if (productsByStatus['On-Update'].length > 0) {
      console.log('');
      console.log(`**🛠️ UPDATING**`);
      productsByStatus['On-Update'].forEach(p => console.log(`├─ ${p}`));
    }
    if (productsByStatus.Risk.length > 0) {
      console.log('');
      console.log(`**⚠️ RISK**`);
      productsByStatus.Risk.forEach(p => console.log(`├─ ${p}`));
    }
    if (productsByStatus.Closed.length > 0) {
      console.log('');
      console.log(`**❌ CLOSED**`);
      productsByStatus.Closed.forEach(p => console.log(`├─ ${p}`));
    }

    console.log('');
    console.log('─'.repeat(60));
    console.log('');
  });

  // Footer
  const now = new Date();
  const utcTime = now.toLocaleString('en-US', {
    timeZone: 'UTC',
    hour12: false,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  console.log(`🕐 ${utcTime} UTC  •  Auto-refresh every 5min`);
  console.log('');

  console.log('='.repeat(60));
  console.log('✅ Embed preview completed!');
  console.log('='.repeat(60));
};

testEmbed().catch(console.error);
