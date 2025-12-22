import axios from 'axios';
import * as cheerio from 'cheerio';

const debugStructure = async () => {
  try {
    const { data } = await axios.get('https://indohax.net/status', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    const $ = cheerio.load(data);

    console.log('🔍 Full structure of first 30 elements (h3 and h4):\n');

    let count = 0;
    $('h3, h4').each((i, el) => {
      if (count >= 30) return false;

      const $el = $(el);
      const tag = el.tagName;
      const text = $el.text().trim();
      const indent = tag === 'h3' ? '' : '  ';

      console.log(`${indent}[${tag}] ${text}`);

      count++;
    });

    console.log('\n\n🔍 Looking for status category pattern:\n');

    let lastStatusCategory = '';
    let gameCount = 0;

    $('h3, h4').each((i, el) => {
      const $el = $(el);
      const tag = el.tagName;
      const text = $el.text().trim();

      if (tag === 'h4') {
        const isStatus = ['Undetect', 'On-Update', 'Risk', 'Closed'].some(cat =>
          text.toLowerCase().includes(cat.toLowerCase())
        );

        if (isStatus) {
          console.log(`📍 Status category: "${text}"`);
          lastStatusCategory = text;
        }
      } else if (tag === 'h3') {
        gameCount++;
        if (gameCount <= 5) {
          console.log(`🎮 Game: "${text}" (Current status would be: ${lastStatusCategory || 'Unknown'})`);
        }
      }
    });

  } catch (error) {
    console.error('Error:', error);
  }
};

debugStructure();
