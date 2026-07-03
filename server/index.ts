import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { ChatTurnRequest } from "../shared/types";
import { handleChannelTurn, handleChatTurn, hydrateActionResponse } from "./services/chatService";
import { CerbanimoClient } from "./services/cerbanimoClient";
import { extractString, extractText, toChannelOutbound } from "./services/channelAdapter";

const app = express();
const port = Number(process.env.PORT ?? 4177);
const distPath = path.resolve(process.cwd(), "dist");

app.use(
  cors({
    origin: process.env.KAMIYA_ALLOWED_ORIGIN ?? "http://localhost:5173",
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

const authSchema = z.object({
  isLoggedIn: z.boolean(),
  userId: z.string().optional(),
  displayName: z.string().optional(),
  cerbanimoApiUrl: z.string().optional(),
  cerbanimoToken: z.string().optional(),
  permissions: z.array(z.string()).optional()
});

const chatTurnSchema = z.object({
  message: z.string().min(1),
  history: z.array(z.unknown()).default([]),
  session: z.record(z.unknown()).default({}),
  auth: authSchema
});

const chatAuthSchema = z.object({
  auth: authSchema
});

const loadChatSchema = chatAuthSchema.extend({
  chatId: z.number()
});

const actionHydrateSchema = chatAuthSchema.extend({
  actionId: z.string().min(1),
  session: z.record(z.unknown()).default({})
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "kamiya-api",
    geminiModel: process.env.KAMIYA_GEMINI_MODEL ?? "gemini-3.1-flash-lite",
    liveGemini: Boolean(process.env.KAMIYA_GEMINI_API_KEY),
    cerbanimoConfigured: Boolean(process.env.KAMIYA_CERBANIMO_API_URL && process.env.KAMIYA_CERBANIMO_BEARER_TOKEN)
  });
});

app.post("/api/chat/turn", async (req, res, next) => {
  try {
    const parsed = chatTurnSchema.parse(req.body) as ChatTurnRequest;
    const response = await handleChatTurn(parsed);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

app.post("/api/chats/list", async (req, res, next) => {
  try {
    const parsed = chatAuthSchema.parse(req.body);
    const result = await new CerbanimoClient(parsed.auth).listChats();
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    res.json(result.data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/chats/load", async (req, res, next) => {
  try {
    const parsed = loadChatSchema.parse(req.body);
    const result = await new CerbanimoClient(parsed.auth).loadChat(parsed.chatId);
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    res.json(result.data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/actions/hydrate", async (req, res, next) => {
  try {
    const parsed = actionHydrateSchema.parse(req.body);
    const response = await hydrateActionResponse(parsed.auth, parsed.session, parsed.actionId);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

app.post("/api/adapters/discord", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const response = await handleChannelTurn({
      channel: "discord",
      text: extractText(body, ["content", "message.content", "data.options.0.value"]),
      externalUserId: extractString(body, ["authorId", "user.id"]),
      workspaceId: extractString(body, ["guildId"]),
      displayName: extractString(body, ["displayName", "author.username"])
    });
    res.json(toChannelOutbound("discord", response));
  } catch (error) {
    next(error);
  }
});

app.post("/api/adapters/slack", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const response = await handleChannelTurn({
      channel: "slack",
      text: extractText(body, ["text", "event.text", "command.text"]),
      externalUserId: extractString(body, ["user_id", "event.user"]),
      workspaceId: extractString(body, ["team_id", "team.id"]),
      displayName: extractString(body, ["user_name"])
    });
    res.json(toChannelOutbound("slack", response));
  } catch (error) {
    next(error);
  }
});

app.post("/api/adapters/google-chat", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const response = await handleChannelTurn({
      channel: "google_chat",
      text: extractText(body, ["message.text", "text"]),
      externalUserId: extractString(body, ["user.name"]),
      workspaceId: extractString(body, ["space.name"]),
      displayName: extractString(body, ["user.displayName"])
    });
    res.json(toChannelOutbound("google_chat", response));
  } catch (error) {
    next(error);
  }
});

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  void next;
  const message = error instanceof Error ? error.message : "Unknown Kamiya API error";
  res.status(400).json({ ok: false, error: message });
});

app.listen(port, () => {
  console.log(`Kamiya listening on 0.0.0.0:${port}`);
});
