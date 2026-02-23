import dotenv from "dotenv";
dotenv.config();

import { WebClient } from "@slack/web-api";
import { askGPT } from "./gpt/gptClient.js";
import { config } from "./config.js";
import RSSParser from "rss-parser";
import { extract } from "@extractus/article-extractor";
import { parseISO, differenceInDays } from "date-fns";
import { htmlToText } from 'html-to-text';
import { fetchPostedArticles, appendPostedArticles } from "./utils/sheets.js";
import { DateTime } from "luxon";
import fs from "fs";

const slackToken = config.slack.token;
const channelId = config.slack.channelId;
const errorRecipients = config.slack.errorRecipients;

const slackClient = new WebClient(slackToken);
const parser = new RSSParser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8'
  }
});

export async function fetchFeeds(feedUrls, maxArticles = null) {
  const allArticles = [];
  const now = new Date();

  const shuffleArray = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const feedsToProcess = shuffleArray(feedUrls);
  const blockedFeeds = new Set();

  const perFeedLimit = maxArticles && feedUrls.length ? Math.max(1, Math.ceil(maxArticles / feedUrls.length)) : null;
  const perFeedCounts = new Map();

  for (const url of feedsToProcess) {
    if (blockedFeeds.has(url)) continue;
    try {
      const feed = await parser.parseURL(url);
      const items = shuffleArray(feed.items || []);

      for (const item of items) {
        const published = parseISO(item.isoDate);

        // Only process recent items with links
        if (!item.link) continue;

        if (perFeedLimit) {
          const count = perFeedCounts.get(url) || 0;
          if (count >= perFeedLimit) break;
        }

        try {
          const extraction = await extract(item.link);
          // console.log(extraction);

          if (!extraction || !extraction.content) continue;
          const daysOld = differenceInDays(now, published);
          if (Number.isFinite(daysOld) && daysOld > config.settings.lookback_window) continue;

          console.log("Article ingested: ", item.title, " - ", item.link)
          allArticles.push({
            articleTitle: item.title || extraction.title,
            articleUrl: item.link,
            articlePublisher: feed.title || extraction.source,
            articlePublishedDate: item.isoDate || extraction.published,
            articleAuthor: extraction.author || item.creator || null,
            articleContent: htmlToText(extraction.content, {
              wordwrap: true,
            }),
            // extraction.content, // full text content (HTML stripped)
            articleImageUrl: extraction.image || null,
          });

          if (perFeedLimit) {
            perFeedCounts.set(url, (perFeedCounts.get(url) || 0) + 1);
          }

          // Stop if we've reached the limit
          if (maxArticles && allArticles.length >= maxArticles) {
            return allArticles;
          }
        } catch (err) {
          const msg = String(err?.message || "");
          if (msg.includes("403")) {
            console.warn(`❌ 403 on ${item.link}; \n  > marking feed blocked and skipping remaining items`);
            blockedFeeds.add(url);
            break;
          }
          console.warn(`❌ Failed to extract ${item.link}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error(`⚠️ Error parsing feed ${url}: ${err.message}`);
    }
  }

  return allArticles;
}

// export function filterRecentEnglish(articles) {
//   return articles.filter(a => {
//     const daysAgo = differenceInDays(new Date(), parseISO(a.articlePublishedDate || new Date()));
//     const isEnglish = /^[\x00-\x7F]*$/.test(a.articleContent || "");
//     return daysAgo <= config.settings.lookback_window && isEnglish;
//   });
// }

// function prepareArticlesForGPT(articles, maxChars = 3000) {
//   return articles.map(a => ({
//     ...a,
//     articleContent: a.articleContent.slice(0, maxChars),
//   }));
// }

async function notifyErrors(errorText) {
  if (!Array.isArray(errorRecipients) || errorRecipients.length === 0) {
    console.warn("No error recipients configured.");
    return;
  }
  for (const userId of errorRecipients) {
    try {
      await slackClient.chat.postMessage({
        channel: userId,
        text: `:warning: ${errorText}`,
      });
      console.log(`Error notification sent to user ${userId}`);
    } catch (err) {
      console.error(
        `Failed to send error notification to user ${userId}: `,
        err
      );
    }
  }
}

const buildPrompt = (articlesJson) => `
You are an expert marketing news curator. You will be given a list of articles in JSON format. Look at the object allArticles.content and select the top 3 highest-scoring articles.

Your task:
1. Evaluate each article based on the criteria below.
2. Select the single highest-scoring article (top 1).
3. Return the result in strict JSON format (no extra text).
4. If any of the articles provided contain potential sensitive or proprietary data or does not comply with usage policies, please exclude them from selection and move to the next article.

### Criteria for article selection:
- Articles must be published within the last 60 days.
- Articles must be in English.
- Articles must NOT be paywalled.
- Articles must be relevant to one or more of the following topics:
  - Campaign case studies
  - Tools in use
  - AI in social
  - AI in creative automation
  - AI platforms
  - AI measurement
  - Regulation and ethics
  - Marketing automation
  - Marketing technology
  - Marketing trends
  - Marketing best practices
  - Marketing case studies
  - Marketing research
  - Marketing insights
- Prioritize reputable sources with original reporting or analysis.
- Prefer globally relevant content, but give a modest boost to APAC-related articles (AU/NZ/SG/HK/JP/KR/IN).
- Exclude region specific news that are outside of APAC (e.g. US political ads regulation, 'Search Central Live is coming back to South America').

### Scoring rubric (0-42 total + up to +3 APAC bonus):
Each article is scored as follows (keep top scores rare and justify briefly):
- Relevance to brief themes: 0-12 (12 only if tightly on-core topics with depth; 9-11 strong; 6-8 solid; 3-5 partial; 1-2 weak; 0 off-brief)
- Impact for marketers: 0-12 (12 only if it shifts strategy/budget/roadmaps; 9-11 strong, actionable implications; 6-8 useful but limited; 3-5 minor/tactical; 1-2 trivial; 0 none)
- Source quality: 0-9 (9 top-tier/original/first-party data; 6-8 reputable industry outlet; 3-5 thin/aggregated/PR-heavy; 1-2 unknown/low-signal; 0 untrusted)
- Recency: 0-9 (0-7 days = 9; 8-21 = 6; 22-60 = 3; older = 0)
- APAC relevance bonus: +0 to +3 (0 none; 1 light tie; 2 clear APAC focus; 3 strongly centered on APAC)

score_total = relevance + impact + source + recency (+ APAC bonus if any). Totals ≥35 should be rare and only when all dimensions are truly strong.

### Output generation:
For the top article:
- Generate a **Key Takeaway** (1-2 sentences summarizing the main insight). 
- Generate **Why it matters** (1 short paragraph for marketers).
- Generated **Key Takeaway** and **Why it matters** should be of roughly equal length, with **Key Takeway** allowed to be slightly longer if needed.
- Generate **Insights** (3-5 bullet points of specific learnings or implications). Using 5 points is not mandatory; use your judgment based on article depth. Use fewer points when appropriate.
- Generate **Why it matters for 1000heads** (1 short paragraph contextualized to 1000heads' marketing and innovation focus).
- Emphasis words by wrapping them in * for bold, and _ for italics. Always add emphases where you think appropriate to make the text more engaging and readable.
- Emphasis numbers and statistics by wrapping them in \` for code style.
- The JSON must parse with JSON.parse() without errors.
- The ONLY allowed backslashes in the entire output are those required by JSON escaping:
   - \" to escape a quote inside a string
   - \\ to represent a literal backslash
   - \\n \\r \\t \\b \\f or \\uXXXX for control characters (only if needed)

### Return format (STRICT JSON only):
[
  {
    "articleTitle": "<title of the article chosen>",
    "articleUrl": "<url of the article chosen>",
    "articlePublisher": "<publisher of the article chosen>",
    "articlePublishedDate": "<published date of the article chosen>",
    "articleImageUrl": "<image url of the article chosen>",
    "articleImageCaption": "<caption of the image of the article chosen>",
    "articleImageCredit": "<credit of the image of the article chosen>",
    "articleImageLicense": "<license of the image of the article chosen>",
    "articleImageLicenseUrl": "<license url of the image of the article chosen>",
    "score_relevance": "<score for relevance to brief themes>",
    "score_impact": "<score for impact for marketers>",
    "score_source": "<score for source quality>",
    "score_recency": "<score for recency>",
    "score_apac": "<score for APAC relevance bonus>",
    "score_total": "<total scoring = sum of components out of /42 +3 from bonus if applicable>",
    "keyTakeaway": "<generated takeaway from the article chosen>",
    "insights": [
      "<generated insight from article chosen #1>",
      "<generated insight from article chosen #2>",
      "<generated insight from article chosen #3>",
      "<generated insight from article chosen #4>", // optional
      "<generated insight from article chosen #5>"  // optional
    ],
    "whyItMatters": "<generated conclusion on why this article matters that is short, direct, framed for marketers>",
    "whyItMattersFor1000heads": "<generated conclusion on why this article matters that is short, direct, framed for 1000heads>",
  }
]

Return ONLY a JSON array (no enclosing object, no "results" property).

Articles are as below:
${articlesJson}
`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeUrl = (url) =>
  String(url || "")
    .trim()
    .replace(/\u200B/g, "")
    .replace(/\/$/, "")
    .toLowerCase();

async function run() {
  let hasError = false;
  try {
    let dedupeEnabled = true;
    let postedUrls = new Set();

    const credsPath = config.google.credentialsPath;
    if (!credsPath || !fs.existsSync(credsPath)) {
      dedupeEnabled = false;
      console.warn("Sheets credentials missing or unreadable; skipping dedupe this run.");
      await notifyErrors("Sheets credentials missing or unreadable; skipping dedupe this run.");
    } else {
      postedUrls = await fetchPostedArticles();
    }

    const feeds = await fetchFeeds(config.feeds, config.settings.max_articles_per_run);

    const freshArticles = [];
    for (const article of feeds) {
      const urlKey = normalizeUrl(article.articleUrl);
      if (dedupeEnabled && urlKey && postedUrls.has(urlKey)) {
        console.log("🔁 Dedupe hit; skipping already-posted article:", article.articleTitle || article.articleUrl);
        continue;
      }
      freshArticles.push(article);
    }

    if (!freshArticles.length) {
      console.log("No new articles to process after dedupe.");
      return;
    }

    const prompt = buildPrompt(JSON.stringify(freshArticles, null, 2));
    const gptResponse = await askGPT(prompt);
    console.log("GPT response received");
    console.log(gptResponse);

    const parsed = JSON.parse(gptResponse);
    const articles = Array.isArray(parsed)
      ? parsed
      : (parsed && Array.isArray(parsed.results)
          ? parsed.results
          : (parsed && Array.isArray(parsed.articles) ? parsed.articles : []));
    if (!articles.length) {
      console.warn("GPT returned no parsable articles; aborting post.");
      await notifyErrors("GPT returned no parsable articles; aborting post.");
      return;
    }

    const articlesToPost = articles.slice(0, 1);

    const isValidArticle = (a) => a && typeof a.articleUrl === "string" && a.articleUrl.trim() && typeof a.articleTitle === "string" && a.articleTitle.trim();

    for (let i = 0; i < articlesToPost.length; i++) {
      const article = articlesToPost[i];
      if (!isValidArticle(article)) {
        console.warn("Invalid article payload; skipping", article);
        continue;
      }
      const urlKey = normalizeUrl(article.articleUrl);

      if (dedupeEnabled && urlKey && postedUrls.has(urlKey)) {
        console.log("Skipping already-posted article: ", article.articleTitle || article.articleUrl);
        continue;
      }

      const res = await postToSlack(article);
      const postedDate = (() => {
        const zone = "Asia/Kuala_Lumpur";
        if (res?.ts) {
          const seconds = Number(String(res.ts).split(".")[0]);
          if (Number.isFinite(seconds)) {
            return DateTime.fromSeconds(seconds, { zone }).toISO();
          }
        }
        return DateTime.now().setZone(zone).toISO();
      })();

      await appendPostedArticles([
        {
          ...article,
          postedDate,
          slackTimestamp: res?.ts ?? "",
          slackChannel: res?.channel ?? "",
        },
      ]);

      if (urlKey) postedUrls.add(urlKey);

      const isLast = i === articles.length - 1;
      if (!isLast) {
        await sleep(config.settings.delay); // wait between posts
      }
    }
  } catch (err) {
    hasError = true;
    console.error("Error in run function: ", err);
    await notifyErrors(`Error in run function: ${err.message}`);
  }

  return hasError ? 1 : 0;
}

async function postToSlack(a) {
  const url = String(a.articleUrl ?? "").replace(/\u200B/g, "").trim();

  const iso = a.articlePublishedDate;
  const ts = iso ? Math.floor(new Date(iso).getTime() / 1000) : null;
  const slackDate = ts ? `<!date^${ts}^{date_short} {time}|${iso}>` : "—";

  const isUsableImage = (url) => {
    const u = String(url || "").trim();
    if (!u.startsWith("http")) return false;
    if (u.toLowerCase().endsWith(".svg")) return false; // Slack often rejects svg
    return true;
  };

  const toReactionName = (val) => {
    const v = String(val || "").trim();
    if (!v) return null;
    const stripped = v.startsWith(":") && v.endsWith(":") ? v.slice(1, -1) : v;
    if (/\s/.test(stripped)) return null;
    return stripped;
  };

  // Header must be plain_text + <= 150 chars
  const title = String(a.articleTitle ?? "Untitled").replace(/\u200B/g, "").trim().slice(0, 150);

  // Keep fields within reason; Slack has per-block and per-field text limits
  const keyTakeaway = String(a.keyTakeaway ?? "—").trim();
  const whyItMatters = String(a.whyItMatters ?? "—").trim();
  const whyFor1k = String(a.whyItMattersFor1000heads ?? "—").trim();

  const insightsArr = Array.isArray(a.insights) ? a.insights : [];
  const insightsText = insightsArr.length
    ? insightsArr.map(i => `• ${String(i).trim()}`).join("\n")
    : "—";

  const imageUrl = isUsableImage(a.articleImageUrl) ? String(a.articleImageUrl).trim() : "";

  try {
    const blocks = [
      {
        type: "header",
        text: { type: "plain_text", text: title }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `by *${a.articlePublisher ?? "Unknown"}*${url ? ` | <${url}|Read full article>` : ""}`
          }
        ]
      },
    ];

    if (imageUrl) {
      blocks.push({
        type: "image",
        image_url: imageUrl,
        alt_text: "Article image"
      });
    }

    blocks.push(
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Key Takeaway:*\n${keyTakeaway}\n\n` },
          { type: "mrkdwn", text: `*Why it matters:*\n${whyItMatters}` }
        ]
      },
      { type: "divider" },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Insights:*\n${insightsText}\n\n` }
      },
      { type: "divider" },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Why it matters for 1000heads:*\n${whyFor1k}` }
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: `date published: ${slackDate}\n\n` }]
      }
    );

    const sendMessage = async (useBlocks) =>
      slackClient.chat.postMessage({
        channel: channelId,
        text: title,          // keep fallback text
        blocks: useBlocks,
        unfurl_links: false,
        unfurl_media: false,
        username: config.slack.botName,
      });

    let res;
    try {
      res = await sendMessage(blocks);
    } catch (err) {
      const errMsg = String(err?.data?.error || err?.message || "");
      const invalidBlocks = errMsg.includes("invalid_blocks") || errMsg.includes("image_url");
      if (imageUrl && invalidBlocks) {
        console.warn("Image block failed; retrying without image", err?.data ?? err);
        const blocksNoImage = blocks.filter(b => b.type !== "image");
        res = await sendMessage(blocksNoImage);
      } else {
        throw err;
      }
    }

    // Add preset reactions in order
    for (const name of config.slack.postReactions) {
      try {
        await slackClient.reactions.add({
          channel: res.channel,
          timestamp: res.ts,
          name,
          username: config.slack.botName,
        });
      } catch (err) {
        console.warn("Reaction add failed:", err?.data ?? err);
      }
    }

    const threadText = "Quick feedback please: react with :+1: if helpful, :no_entry: if off-brief, and :eyes: if worth a deeper look.";
    try {
      await slackClient.chat.postMessage({
        channel: res.channel,
        thread_ts: res.ts,
        text: threadText,
        unfurl_links: false,
        unfurl_media: false,
        username: config.slack.botName,
      });
    } catch (threadErr) {
      console.warn("Thread post failed:", threadErr?.data ?? threadErr);
    }

    console.log("Message sent:", res.ts);
    return res;
  } catch (error) {
    console.error("Error posting to Slack:", error?.data ?? error);
    await notifyErrors(`Error posting to Slack: ${error?.message ?? String(error)}`);
    throw error;
  }
}

const exitCode = await run();
// Force deterministic shutdown for cron/lock-file workflows.
process.exit(exitCode);
