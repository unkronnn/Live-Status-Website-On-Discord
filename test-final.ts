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

const scrapeStatus = async (): Promise<GameGroup[]> => {
  try {
    console.log(`Testing improved scraper for: ${CONFIG.URL}\n`);

    const { data } = await axios.get(CONFIG.URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://indohax.net/',
      },
      timeout: 15000
    });

    console.log('✅ Successfully fetched HTML!\n');

    const $ = cheerio.load(data);
    const gamesMap = new Map<string, Array<{ name: string; status: string }>>();

    // Check for game sections
    const gameSections = $('.pstat-game-section').length;
    console.log(`🎮 Found ${gameSections} game sections\n`);

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

    if (gameGroups.length === 0) {
      console.error('❌ No data found!');
    } else {
      const totalProducts = gameGroups.reduce((acc, g) => acc + g.products.length, 0);
      console.log(`✅ Successfully scraped ${gameGroups.length} games with ${totalProducts} products!\n`);

      // Show first 3 games with their statuses
      console.log('📋 Sample Data (First 3 games):');
      gameGroups.slice(0, 3).forEach((game, i) => {
        console.log(`\n  ${i + 1}. **${game.gameName}** (${game.products.length} products)`);
        game.products.slice(0, 5).forEach(p => {
          const emoji = p.status === 'Undetect' ? '✅' :
                       p.status === 'On-Update' ? '🛠️' :
                       p.status === 'Risk' ? '⚠️' :
                       p.status === 'Closed' ? '❌' : '⚪';
          console.log(`     ${emoji} ${p.name} [${p.status}]`);
        });
        if (game.products.length > 5) {
          console.log(`     ... and ${game.products.length - 5} more`);
        }
      });

      // Show status distribution
      const statusCount = { Undetect: 0, 'On-Update': 0, Risk: 0, Closed: 0, Unknown: 0 };
      gameGroups.forEach(g => {
        g.products.forEach(p => {
          statusCount[p.status as keyof typeof statusCount]++;
        });
      });
      console.log('\n📊 Status Distribution:');
      Object.entries(statusCount).forEach(([status, count]) => {
        if (count > 0) {
          const emoji = status === 'Undetect' ? '✅' :
                       status === 'On-Update' ? '🛠️' :
                       status === 'Risk' ? '⚠️' :
                       status === 'Closed' ? '❌' : '⚪';
          console.log(`   ${emoji} ${status}: ${count}`);
        }
      });
    }

    return gameGroups;
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
};

scrapeStatus()
  .then(groups => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ Test completed! Total games: ${groups.length}`);
    console.log(`${'='.repeat(50)}`);
  })
  .catch(err => {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  });
