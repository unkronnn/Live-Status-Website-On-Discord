import axios from 'axios';
import * as cheerio from 'cheerio';

const CONFIG = {
  URL: 'https://indohax.net/status',
};

const debugHTML = async () => {
  try {
    console.log(`Fetching: ${CONFIG.URL}\n`);

    const { data } = await axios.get(CONFIG.URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://indohax.net/',
      },
      timeout: 15000
    });

    console.log('✅ Fetched successfully!');
    console.log(`📄 HTML Length: ${data.length} characters\n`);

    const $ = cheerio.load(data);

    // Look for different possible structures
    console.log('🔍 Searching for tables...');
    const tables = $('table').length;
    console.log(`   Found ${tables} <table> elements`);

    console.log('\n🔍 Searching for divs with common class names...');
    ['status', 'product', 'game', 'item', 'list', 'row'].forEach(cls => {
      const count = $(`div[class*="${cls}"]`).length;
      if (count > 0) console.log(`   div[class*="${cls}"]: ${count}`);
    });

    console.log('\n🔍 Searching for lists (<ul>, <ol>)...');
    console.log(`   <ul>: ${$('ul').length}`);
    console.log(`   <ol>: ${$('ol').length}`);
    console.log(`   <li>: ${$('li').length}`);

    // Look for card elements
    console.log('\n🔍 Searching for cards...');
    console.log(`   .card: ${$('.card').length}`);
    console.log(`   .card-body: ${$('.card-body').length}`);

    // Show all h1-h6 headings
    console.log('\n📰 Headings found:');
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
      $(tag).each((i, el) => {
        const text = $(el).text().trim();
        if (text) console.log(`   ${tag}: "${text.substring(0, 80)}"`);
      });
    });

    // Look for any text that might be a game name
    console.log('\n🎮 Looking for potential game names in bold/strong...');
    const potentialGames: string[] = [];
    $('strong, b').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length < 50 && text.length > 2) {
        potentialGames.push(text);
      }
    });

    console.log(`   Found ${potentialGames.length} bold texts`);
    console.log('   First 10:', potentialGames.slice(0, 10).map(t => `"${t}"`).join(', '));

    // Look for status emojis
    console.log('\n📊 Looking for status emojis in text...');
    const emojiCount = (data.match(/✅/g) || []).length;
    const wrenchCount = (data.match(/🛠️/g) || []).length;
    const warningCount = (data.match(/⚠️/g) || []).length;
    const xCount = (data.match(/❌/g) || []).length;

    console.log(`   ✅ : ${emojiCount}`);
    console.log(`   🛠️ : ${wrenchCount}`);
    console.log(`   ⚠️ : ${warningCount}`);
    console.log(`   ❌ : ${xCount}`);
    console.log(`   Total status indicators: ${emojiCount + wrenchCount + warningCount + xCount}`);

    // Try to find the main content area
    console.log('\n🏗️  Looking for main content container...');
    ['main', '[role="main"]', '.content', '#content', '.container', 'body > div'].forEach(selector => {
      const count = $(selector).length;
      if (count > 0) {
        console.log(`   ${selector}: ${count} found`);
        const first = $(selector).first();
        const text = first.text().trim().substring(0, 200);
        console.log(`      First element preview: "${text}..."`);
      }
    });

    // Save a sample of the body HTML for inspection
    console.log('\n💾 Saving body HTML sample to debug-body.html...');
    const bodyHTML = $('body').html();
    if (bodyHTML && bodyHTML.length > 0) {
      const fs = require('fs');
      fs.writeFileSync('debug-body.html', bodyHTML.substring(0, 50000));
      console.log('   ✅ Saved first 50000 characters to debug-body.html');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
};

debugHTML();
