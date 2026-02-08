import dotenv from "dotenv";
dotenv.config();

const parseList = (value, fallback = []) => {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const FEED = [
  "https://martech.org/feed",
  "https://searchengineland.com/feed",
  "https://www.socialmediaexaminer.com/feed/",
  "https://www.marketingdive.com/feeds/news",
  "http://www.marketingaiinstitute.com/blog/rss.xml",
  "https://blog.hubspot.com/marketing/rss.xml",
  "https://www.searchenginejournal.com/feed/",
  "https://www.smartinsights.com/feed/",
  "https://copyblogger.com/feed/",
  "https://www.netimperative.com/feed/",
  "https://www.adexchanger.com/feed/",
  "https://www.exchangewire.com/feed/",
  "https://martechseries.com/feed/",
  "https://customerthink.com/feed/",
  "https://www.marketingtechnews.net/feed/",
  "https://mobilemarketingmagazine.com/feed/",
  "https://influencermarketinghub.com/feed/",
  "https://www.convinceandconvert.com/feed/",
  "https://copyhackers.com/blog/feed/",
  "https://segment.com/blog/rss.xml",
  "https://www.litmus.com/blog/feed/",
  "https://www.campaignmonitor.com/blog/rss/",
  "https://vwo.com/blog/feed/",
  "https://ahrefs.com/blog/rss/",
  "https://sparktoro.com/blog/feed/",
  "https://buffer.com/resources/feed/",
  "https://sproutsocial.com/insights/feed/",
  "https://www.socialpilot.co/blog/feed",
  "https://www.agorapulse.com/blog/feed/",
  "https://planable.io/blog/feed/",
  "https://campaignbriefasia.com/feed/",
  "https://stoppress.co.nz/feed/",
  "https://iabaustralia.com.au/feed/",
  "https://mumbrella.com.au/feed",
  "https://campaignme.com/feed/",
  "https://www.communicateonline.me/feed/",
  "https://the-media-leader.com/feed/",
  "https://blog.chartmogul.com/feed/",
  "https://feeds.feedburner.com/blogspot/amDG",
  // Added after
  "https://www.socialmediatoday.com/feeds/news/",
  "https://restofworld.org/feed/latest",
  "https://www.itsnicethat.com/?nicefeed=",
  "https://www.creativeboom.com/feed/",
  // "https://designtaxi.com/news.rss", // possibly blocked 403
  "https://www.digitalartsonline.co.uk/news/feed/",
  "https://www.adweek.com/category/creative/feed/",
  "https://stratechery.com/feed/",
  "https://fs.blog/feed/",
  "https://www.brandinginasia.com/feed/",
];

//GPT SETTINGS
const GPT_MODEL = "gpt-4o";

// BOT SETTINGS
const POSTS_PER_CYCLE = 3;
const DELAY = 1000 * 60 * 0.5; // 30 seconds
const LOOKBACK_WINDOW = 60; // 60 days

// SLACK BOT CONFIG
const SLACK_BOT_NAME = "1Khx 🚀";
const POST_REACTIONS = ["🚀", "🤔", "👎"];

export const config = {
  settings: {
    posts: POSTS_PER_CYCLE,
    delay: DELAY,
    lookback_window: LOOKBACK_WINDOW
  },
  slack: {
    token: process.env.SLACK_BOT_TOKEN,
    channelId: process.env.SLACK_CHANNEL_ID,
    errorRecipients: parseList(process.env.SLACK_ERROR_USER_IDS),
    botName: SLACK_BOT_NAME,
    postReactions: POST_REACTIONS,
  },
  feeds: parseList(FEED),
  // prompt: prompt,
  gpt: {
    apiKey: process.env.OPENAI_API_KEY,
    model: GPT_MODEL,
  },
  google: {
    apiKey: process.env.GOOGLE_API_KEY,
    cseId: process.env.GOOGLE_CSE_ID,
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    sheetsSpreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    sheetsWorksheetName: process.env.GOOGLE_SHEETS_WORKSHEET_NAME || "Articles",
  },
};
