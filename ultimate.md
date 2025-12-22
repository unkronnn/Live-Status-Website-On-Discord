**Role:** Senior Node.js Developer & Web Scraping Specialist.
**Task:** Build a production-ready Discord Bot to monitor cheat statuses from `https://indohax.net/status`.

**Context:**
The previous attempt failed with "No Data Found" likely due to missing User-Agent headers or incorrect DOM parsing logic. The target website lists cheats in a specific hierarchy: **Game Name (Header)** followed by **Product Rows**.

### **Technical Requirements (Strict):**

1.  **Libraries:** `discord.js` (v14), `axios`, `cheerio`, `dotenv`.
2.  **Anti-Blocking Strategy:**
    * The Axios request **MUST** include real browser headers (`User-Agent`, `Accept`, `Referer`) to bypass basic Cloudflare/WAF checks.
3.  **Advanced Scraping Logic (The Hierarchy):**
    * Do NOT assume a flat table. The scraper must iterate through table rows (`tr`).
    * **Logic:**
        * If a `tr` has only 1 column (or contains a `th` / strong text), treat it as a **Game Name** (Header).
        * If a `tr` has multiple columns, treat it as a **Product Item** belonging to the most recent Game Name found.
    * **Status Extraction:** Look for keywords like "Undetect", "Closed", "Update", "Risk" inside the row text or badge classes.

4.  **UI/UX (Discord Embeds):**
    * **Grouping:** Use the Game Name as the Embed Field **Title**.
    * **Content:** List all products for that game in the Field **Value** (using newlines).
    * **Visual Mapping (Crucial):**
        * "Undetect" / "Safe" → 🟢 (Green)
        * "On-Update" / "Maintenance" → 🛠️ (Blue/Orange)
        * "Detected" / "Closed" → ❌ (Red)
        * "Risk" → ⚠️ (Yellow)
    * **Pagination:** Handle Discord's 25-field limit. Split into multiple embeds if necessary.

5.  **Smart Features:**
    * **Auto-Update:** Refresh every 5 minutes.
    * **No-Spam Mode:** Store Message IDs in memory. On refresh, **edit** the existing messages. If the number of embeds changes (page count change), delete old messages and send new ones.

### **Deliverables:**

**1. Setup Instructions:**
* Provide a complete list of terminal commands to install dependencies and initialize the project (`package.json` setup).
* Provide the exact content for `tsconfig.json`.

**2. The `.env` File:**
* Show the structure for the `.env` file (`DISCORD_TOKEN`, `CHANNEL_ID`, `TARGET_URL`).

**3. The Code (`src/index.ts`):**
* Provide the **Full, Single-File TypeScript Code**.
* **Debug Feature:** If the scraper returns 0 items, strictly log: `console.log("Debug HTML snippet:", $.html().substring(0, 500))` so I can debug the layout.
* Ensure types are strictly defined (Interfaces for `GameGroup`, `Product`).

**Go.**