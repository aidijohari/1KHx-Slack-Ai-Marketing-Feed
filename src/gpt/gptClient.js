import OpenAI from "openai";
import dotenv from "dotenv";
import { config } from "../config.js";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID,
});

export async function askGPT(prompt) {
  console.log("Sending prompt, await reply from GPT...")
  const response = await openai.chat.completions.create({
    model: config.gpt.model,
    messages: [{ role: "user", content: prompt }],
  });
  // console.log("response", response.choices[0].message.content);
  return response.choices[0].message.content;
}
