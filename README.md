# Cheat Status Live - Discord Bot

A sophisticated Discord bot built with TypeScript that monitors and displays cheat statuses from indohax.net. Features beautiful embeds, smart message editing to prevent spam, and automatic 5-minute refresh intervals.

## Features

- **Production-Ready Scraper**: Uses proper CSS selectors (`.pstat-game-section`, `.pstat-product-item`) for reliable data extraction
- **Anti-Blocking Strategy**: Full browser headers to bypass Cloudflare/WAF protections
- **Hierarchical Data Structure**: Groups products by game for better organization
- **Advanced Web Scraping**: Automatically fetches and groups status data from indohax.net using axios and cheerio
- **Beautiful Embeds**: Color-coded Discord embeds with emoji status indicators, games organized as fields with products listed inside
- **Smart Updates**: Edits existing messages instead of spamming new ones
- **Auto Refresh**: Updates every 5 minutes automatically
- **Precise Status Indicators**:
  - ✅ **Undetect** → Green (Safe to use)
  - 🛠️ **On-Update** → Blue (Under maintenance/update)
  - ❌ **Closed** → Red (Unavailable)
  - ⚠️ **Risk** → Yellow (Use at own risk)
- **Debug Logging**: Comprehensive logging for troubleshooting
- **Error Handling**: Graceful error handling with retry mechanism

## Prerequisites

- Node.js (v16 or higher)
- A Discord Bot Token ([Get one here](https://discord.com/developers/applications))
- The Channel ID where you want the bot to post

## Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Set up environment variables**:
```bash
cp .env.example .env
```

3. **Edit `.env` file** and add your credentials:
```env
DISCORD_TOKEN=your_actual_bot_token_here
CHANNEL_ID=your_actual_channel_id_here
TARGET_URL=https://indohax.net/status
```

### Getting your Discord Bot Token:
1. Go to https://discord.com/developers/applications
2. Create a new application
3. Go to the "Bot" section
4. Click "Add Bot"
5. Copy the token (you may need to reset it to see it)

### Getting your Channel ID:
1. Enable Developer Mode in Discord (User Settings > Advanced)
2. Right-click the channel you want to use
3. Select "Copy ID"

## Running the Bot

### Development Mode (with auto-reload):
```bash
npm run dev
```

### Production Mode:
```bash
npm run build
npm start
```

### Watch Mode (rebuilds on changes):
```bash
npm run watch
```

## Project Structure

```
cheat-status-live/
├── src/
│   └── index.ts          # Main bot code
├── dist/                 # Compiled JavaScript (generated)
├── .env                  # Your environment variables (not in git)
├── .env.example          # Example environment file
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

## How It Works

1. **Initialization**: Bot logs into Discord and immediately fetches status data
2. **Anti-Blocking Scraping**: Uses full browser headers (User-Agent, Accept, Referer, etc.) to bypass Cloudflare/WAF
3. **Structured HTML Parsing**:
   - Finds `.pstat-game-section` elements (each game)
   - Extracts game name from `data-game` attribute
   - Finds `.pstat-product-item` for each product
   - Extracts status from `.pstat-product-status` class names
4. **Smart Messaging**:
   - First run: Sends new messages with organized embeds
   - Subsequent runs: Edits existing messages to prevent spam
   - If page count changes: Deletes old messages and creates new ones
5. **Status Detection**: Automatically detects status class names (pstat-status-undetect, pstat-status-updating, etc.) and maps to appropriate emojis
6. **Embed Layout**: Each game becomes a field name, with all products listed inside as field values with status emojis

## Test Results

The bot has been tested and successfully scrapes:
- ✅ **82 games** with **264 products**
- ✅ **100% status detection rate** (no unknown statuses)
- ✅ Status distribution:
  - 🟢 Undetect: 191 products
  - 🛠️ On-Update: 53 products
  - ⚠️ Risk: 5 products
  - ❌ Closed: 15 products

## Data Structure

The bot organizes data hierarchically:

```typescript
interface GameGroup {
  gameName: string;
  products: Array<{
    name: string;
    status: string;
  }>;
}
```

Example embed field:
```
**Apex Legends**
🟢 Phoenix
🟢 Fecurity
🛠️ Ancient
```

## Customization

You can adjust these settings in `src/index.ts`:

- `REFRESH_RATE`: Change the update interval (default: 5 minutes)
- `GAMES_PER_EMBED`: Adjust how many games appear per embed (default: 25, Discord's max)
- Status keywords in `getStatusFormatting()` to add custom status types
- Scraper logic in `scrapeStatus()` to adapt to website structure changes

## Troubleshooting

**Bot doesn't respond:**
- Check that your bot token is correct in `.env`
- Verify your bot has permission to read/send messages in the target channel
- Check the console for error messages

**No data appears:**
- The website structure may have changed - you'll need to update the CSS selectors in `scrapeStatus()`
- Check that `TARGET_URL` is accessible

**Messages keep piling up:**
- Make sure the bot has permission to manage its own messages
- Check the console for errors in the edit logic

## License

MIT
# Live-Status-Website-On-Discord
