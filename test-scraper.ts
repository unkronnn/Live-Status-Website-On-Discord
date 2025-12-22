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
    console.log(`Testing scraper for: ${CONFIG.URL}\n`);

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
      timeout: 15000
    });

    console.log('✅ Successfully fetched HTML!');
    console.log(`📄 HTML Length: ${data.length} characters\n`);

    const $ = cheerio.load(data);
    const gameGroups: GameGroup[] = [];

    // Debug: Log first few table rows
    console.log('🔍 First 5 h3 elements (Games):');
    $('h3').slice(0, 5).each((i, el) => {
      console.log(`  ${i + 1}. "${$(el).text().trim()}"`);
    });
    console.log('');

    console.log('🔍 First 10 h4 elements (Status categories and Products):');
    $('h4').slice(0, 10).each((i, el) => {
      console.log(`  ${i + 1}. "${$(el).text().trim()}"`);
    });
    console.log('');

    // Advanced scraping logic for h3/h4 structure
    const gamesMap = new Map<string, Array<{ name: string; status: string }>>();
    let currentGame = '';
    let currentStatus = 'Unknown';

    const statusCategories = ['Undetect', 'On-Update', 'Risk', 'Closed'];

    $('h3, h4').each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      const tag = el.tagName;

      if (tag === 'h3') {
        currentGame = text;
        currentStatus = 'Unknown';
      } else if (tag === 'h4') {
        const isStatusCategory = statusCategories.some(cat =>
          text.toLowerCase().includes(cat.toLowerCase())
        );

        if (isStatusCategory) {
          if (text.toLowerCase().includes('undetect')) currentStatus = 'Undetect';
          else if (text.toLowerCase().includes('on-update')) currentStatus = 'On-Update';
          else if (text.toLowerCase().includes('risk')) currentStatus = 'Risk';
          else if (text.toLowerCase().includes('closed')) currentStatus = 'Closed';
        } else {
          const match = text.match(/^(.+?)\s*:\s*(.+)$/);

          if (match && currentGame) {
            const productName = match[1].trim();
            const gameContext = match[2].trim();

            if (gameContext.toLowerCase().includes(currentGame.toLowerCase()) ||
                currentGame.toLowerCase().includes(gameContext.toLowerCase()) ||
                gameContext.length < 5) {

              if (!gamesMap.has(currentGame)) {
                gamesMap.set(currentGame, []);
              }

              gamesMap.get(currentGame)!.push({
                name: productName,
                status: currentStatus
              });
            }
          }
        }
      }
    });

    // Convert Map to array
    gamesMap.forEach((products, gameName) => {
      gameGroups.push({
        gameName: gameName,
        products: products
      });
    });

    // Sort alphabetically
    gameGroups.sort((a, b) => a.gameName.localeCompare(b.gameName));

    if (gameGroups.length === 0) {
      console.error('❌ No data found! Debug HTML snippet:');
      console.log($.html().substring(0, 1500));
    } else {
      console.log(`✅ Successfully scraped ${gameGroups.length} games!\n`);

      // Show first 3 games as sample
      console.log('📋 Sample Data (First 3 games):');
      gameGroups.slice(0, 3).forEach((game, i) => {
        console.log(`\n  ${i + 1}. **${game.gameName}**`);
        game.products.slice(0, 5).forEach(p => {
          console.log(`     - ${p.status} ${p.name}`);
        });
        if (game.products.length > 5) {
          console.log(`     ... and ${game.products.length - 5} more`);
        }
      });
    }

    return gameGroups;
  } catch (error) {
    console.error('❌ Error scraping data:', error);
    throw error;
  }
};

// Run the test
scrapeStatus()
  .then(groups => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ Test completed! Total games: ${groups.length}`);
    console.log(`📊 Total products: ${groups.reduce((acc, g) => acc + g.products.length, 0)}`);
    console.log(`${'='.repeat(50)}`);
  })
  .catch(err => {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  });
