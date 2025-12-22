**Role:** You are a Senior TypeScript Developer and Discord Bot Specialist. You are an expert in Web Scraping (Cheerio/Axios) and Discord.js v14.

**Objective:** Create a sophisticated, production-ready Discord Bot that monitors cheat statuses from `https://indohax.net/status` in real-time. The bot must scrape data, format it beautifully into Discord Embeds, and auto-update the same messages to avoid spamming the channel.

---

### **Core Technical Requirements:**

#### **1. Advanced Scraping Logic (Crucial)**
The target website lists cheats in a specific hierarchy: **Game Name** (Header) -> **List of Products** (Items).
* **Do NOT** treat the data as a flat table (e.g., do not repeat the Game Name for every product).
* **Logic:** You must group products by their Game Title.
* **Data Structure:** The scraper function should return data in this format:
    ```typescript
    interface GameGroup {
      gameName: string;
      products: Array<{
        name: string;
        status: string; // e.g., "Undetect", "On-Update", "Closed"
      }>;
    }
    ```

#### **2. Visual & Status Mapping (Strict)**
You must map the specific text found on the website to the following visual indicators in Discord:
* **"Undetect"** → Emoji: 🟢 | Color Indicator: Green
* **"On-Update"** or **"Maintenance"** → Emoji: 🛠️ | Color Indicator: Blue or Orange
* **"Closed"** or **"Detected"** → Emoji: ❌ | Color Indicator: Red
* **"Risk"** → Emoji: ⚠️ | Color Indicator: Yellow

#### **3. Embed Design & Layout**
* **Title:** "🛡️ Indohax Status Monitor"
* **Organization:** * Each **Game** should be a Field Name (e.g., `**Apex Legends**`).
    * The **Field Value** must list all products for that game using newlines.
    * *Example Field Value:*
      > 🟢 Phoenix
      > 🟢 Fecurity
      > 🛠️ Ancient
* **Inline Fields:** Use `inline: true` where possible to fit multiple games side-by-side.
* **Pagination:** Discord limits Embeds to 25 Fields. If there are more than 25 games, split the data into multiple Embeds seamlessly.

#### **4. Smart Auto-Update System (Anti-Spam)**
* The bot must check for updates every **5 minutes** (`setInterval`).
* **Persistence:** The bot must store the `Message IDs` of the sent embeds in a variable (runtime memory).
* **Logic:** * On the first run: Send new messages and save their IDs.
    * On subsequent runs: Fetch the existing messages by ID and use `.edit()` to update the content.
    * *Edge Case:* If the number of Embeds changes (e.g., new games added require a new page), delete old messages and resend fresh ones.

---

### **Deliverables:**

1.  **`package.json` setup:** List the required terminal commands to install `discord.js`, `axios`, `cheerio`, `dotenv`, and their types.
2.  **`src/index.ts` (The Complete Code):** Provide the full, single-file TypeScript code. Ensure you handle:
    * Error handling (if the site is down).
    * Environment variables for `TOKEN`, `CHANNEL_ID`, and `URL`.
    * The Grouping Logic for the scraper.

**Context for Scraping:** Assume the HTML structure consists of headers (Game Names) followed by list items or table rows (Products). Write a robust Cheerio selector logic to traverse this hierarchy.