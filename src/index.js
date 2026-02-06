import dotenv from "dotenv";
dotenv.config();

import { WebClient } from "@slack/web-api";
import { askGPT } from "./gpt/gptClient.js";
import { config } from "./config.js";
import RSSParser from "rss-parser";
import axios from "axios";
import { extract } from "@extractus/article-extractor";
import { parseISO, differenceInDays } from "date-fns";
import { htmlToText } from 'html-to-text';
import { fetchPostedArticles, appendPostedArticles } from "./utils/sheets.js";

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

  for (const url of feedsToProcess) {
    try {
      const feed = await parser.parseURL(url);
      const items = shuffleArray(feed.items || []);

      for (const item of items) {
        const published = parseISO(item.isoDate);

        // Only process recent items with links
        if (!item.link) continue;

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

          // Stop if we've reached the limit
          if (maxArticles && allArticles.length >= maxArticles) {
            return allArticles;
          }
        } catch (err) {
          console.warn(`❌ Failed to extract ${item.link}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error(`⚠️ Error parsing feed ${url}: ${err.message}`);
    }
  }

  return allArticles;
}

export function filterRecentEnglish(articles) {
  return articles.filter(a => {
    const daysAgo = differenceInDays(new Date(), parseISO(a.articlePublishedDate || new Date()));
    const isEnglish = /^[\x00-\x7F]*$/.test(a.articleContent || "");
    return daysAgo <= config.settings.lookback_window && isEnglish;
  });
}

function prepareArticlesForGPT(articles, maxChars = 3000) {
  return articles.map(a => ({
    ...a,
    articleContent: a.articleContent.slice(0, maxChars),
  }));
}

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
2. Select the top 3 highest-scoring articles.
3. Return the results in strict JSON format (no extra text).

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

### Scoring rubric:
Each article is scored as follows (more recent = higher recency score):
- Relevance to brief themes: 0-12
- Impact for marketers: 0-12
- Source quality: 0-9
- Recency: 0-9
- APAC relevance bonus: +3 if applicable

### Output generation:
For the top 3 articles:
- Generate a **Key Takeaway** (1-2 sentences summarizing the main insight). 
- Generate **Why it matters** (1 short paragraph for marketers).
- Generated **Key Takeaway** and **Why it matters** should be of roughly equal length, with **Key Takeway** allowed to be slightly longer if needed.
- Generate **Insights** (3-5 bullet points of specific learnings or implications). Do not always use 5 points if fewer are sufficient.
- Generate **Why it matters for 1000heads** (1 short paragraph contextualized to 1000heads' marketing and innovation focus).
- Emphasis words by wrapping them in * for bold, and _ for italics. Always add emphases where you think appropriate to make the text more engaging and readable.
- Emphasis numbers and statistics by wrapping them in \` for code style.

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
    "score_total": "<total scoring /16 +1 from bonus if applicable>",
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

Articles are as below:
${articlesJson}
`;

// async function formatSlackMessage(gptResponse) {
//   const [a] = JSON.parse(gptResponse);

//   const url = String(a.articleUrl ?? "")
//   .replace(/\u200B/g, "")   // zero-width space (common in LLM output)
//   .trim();

//   const formattedMessage = [
//     `*${a.articleTitle}* by ${a.articlePublisher}`,
//     url,
//     "",
//     `*Key Takeaway*:`,
//     a.keyTakeaway,
//     "",
//     `*Insights*:`,
//     ...(a.insights ?? []).map(insight => `• ${insight}`),
//     "",
//     `*Why it matters*: ${a.whyItMatters}`,
//     "",
//     `*Why it matters for 1000heads*: ${a.whyItMattersFor1000heads}`,
//   ].join("\n");

//   return formattedMessage;
// }


const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeUrl = (url) =>
  String(url || "")
    .trim()
    .replace(/\u200B/g, "")
    .replace(/\/$/, "")
    .toLowerCase();

async function run() {
  try {
    const postedUrls = await fetchPostedArticles();
    const feeds = await fetchFeeds(config.feeds, 100);

    const freshArticles = [];
    for (const article of feeds) {
      const urlKey = normalizeUrl(article.articleUrl);
      if (urlKey && postedUrls.has(urlKey)) {
        console.log("Dedupe hit; skipping already-posted article:", article.articleTitle || article.articleUrl);
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

    const articles = JSON.parse(gptResponse);

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const urlKey = normalizeUrl(article.articleUrl);

      if (urlKey && postedUrls.has(urlKey)) {
        console.log("Skipping already-posted article: ", article.articleTitle || article.articleUrl);
        continue;
      }

      const res = await postToSlack(article);
      const postedDate = res?.ts
        ? new Date(Number(String(res.ts).split(".")[0]) * 1000).toISOString()
        : new Date().toISOString();

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
    console.error("Error in run function: ", err);
    await notifyErrors(`Error in run function: ${err.message}`);
  }
}

async function postToSlack(a) {
  const url = String(a.articleUrl ?? "").replace(/\u200B/g, "").trim();

  const iso = a.articlePublishedDate;
  const ts = iso ? Math.floor(new Date(iso).getTime() / 1000) : null;
  const slackDate = ts ? `<!date^${ts}^{date_short} {time}|${iso}>` : "—";

  const presetReactions = ["thumbsup", "no_entry", "eyes"];

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

  const imageUrl = String(a.articleImageUrl ?? "").trim();

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

    const res = await slackClient.chat.postMessage({
      channel: channelId,
      text: title,          // keep fallback text
      blocks,
      unfurl_links: false,
      unfurl_media: false
    });

    // Add preset reactions
    const results = await Promise.allSettled(
      presetReactions.map(name =>
        slackClient.reactions.add({
          channel: res.channel,
          timestamp: res.ts,
          name
        })
      )
    );

    for (const r of results) {
      if (r.status === "rejected") {
        console.warn("Reaction add failed:", r.reason?.data ?? r.reason);
      }
    }

    const threadText = "Quick feedback please: react with :+1: if helpful, :no_entry: if off-brief, and :eyes: if worth a deeper look.";
    try {
      await slackClient.chat.postMessage({
        channel: res.channel,
        thread_ts: res.ts,
        text: threadText,
        unfurl_links: false,
        unfurl_media: false
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

run();

// const json = await analyzeArticles(prepared);
