import { google } from "googleapis";
import { config } from "../config.js";

const SHEET_COLUMNS = [
  "articleTitle",
  "articleUrl",
  "articlePublisher",
  "articlePublishedDate",
  "articleImageUrl",
  "articleImageCaption",
  "articleImageCredit",
  "articleImageLicense",
  "articleImageLicenseUrl",
  "score_relevance",
  "score_impact",
  "score_source",
  "score_recency",
  "score_apac",
  "score_total",
  "keyTakeaway",
  "insights",
  "whyItMatters",
  "whyItMattersFor1000heads",
  "postedDate",
  "slackTimestamp",
  "slackChannel",
];

const normalizeUrl = (url) =>
  String(url || "")
    .trim()
    .replace(/\u200B/g, "")
    .replace(/\/$/, "")
    .toLowerCase();

const columnLetter = (index) => {
  let dividend = index;
  let columnName = "";
  while (dividend > 0) {
    let modulo = (dividend - 1) % 26;
    columnName = String.fromCharCode(65 + modulo) + columnName;
    dividend = Math.floor((dividend - modulo) / 26);
  }
  return columnName;
};

const sheetRangeEnd = columnLetter(SHEET_COLUMNS.length);

let sheetsClient;

const getSheetsClient = async () => {
  if (sheetsClient) return sheetsClient;

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: config.google.credentialsPath || undefined,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const authClient = await auth.getClient();
    sheetsClient = google.sheets({ version: "v4", auth: authClient });
    return sheetsClient;
  } catch (err) {
    throw new Error(`Failed to init Sheets client: ${err?.message ?? err}`);
  }
};

export async function fetchPostedArticles() {
  const spreadsheetId = config.google.sheetsSpreadsheetId;
  const worksheet = config.google.sheetsWorksheetName;

  if (!spreadsheetId) {
    console.warn("No Google Sheets spreadsheet ID configured; skipping duplicate check.");
    return new Set();
  }

  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${worksheet}!A2:${sheetRangeEnd}`,
    });

    const rows = res.data.values || [];
    const urlIndex = SHEET_COLUMNS.indexOf("articleUrl");

    const urls = rows
      .map((row) => row[urlIndex])
      .filter(Boolean)
      .map((url) => normalizeUrl(url))
      .filter(Boolean);

    return new Set(urls);
  } catch (err) {
    console.warn("Failed to read Google Sheet; continuing without duplicate filter.", err?.message ?? err);
    return new Set();
  }
}

export async function appendPostedArticles(articles) {
  const spreadsheetId = config.google.sheetsSpreadsheetId;
  const worksheet = config.google.sheetsWorksheetName;

  if (!spreadsheetId) {
    console.warn("No Google Sheets spreadsheet ID configured; skipping sheet append.");
    return;
  }

  if (!Array.isArray(articles) || articles.length === 0) return;

  const seenUrls = new Set();
  const rows = articles
    .map((article) => {
      const normalizedUrl = normalizeUrl(article.articleUrl);
      if (normalizedUrl && seenUrls.has(normalizedUrl)) {
        return null;
      }
      if (normalizedUrl) {
        seenUrls.add(normalizedUrl);
      }

      return SHEET_COLUMNS.map((key) => {
        if (key === "articleUrl") {
          return normalizedUrl || article.articleUrl || "";
        }
        const value = article[key];
        if (key === "insights") {
          return Array.isArray(value) ? value.join("\n") : value ?? "";
        }
        return value ?? "";
      });
    })
    .filter(Boolean);

  try {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${worksheet}!A2:${sheetRangeEnd}`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: rows,
      },
    });
  } catch (err) {
    console.warn("Failed to append to Google Sheet:", err?.message ?? err);
  }
}
