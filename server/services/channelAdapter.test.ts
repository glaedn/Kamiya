import { describe, expect, it } from "vitest";
import { extractText, toChannelOutbound } from "./channelAdapter";
import type { ChatTurnResponse } from "../../shared/types";

describe("channelAdapter", () => {
  it("extracts nested text from channel payloads", () => {
    expect(extractText({ event: { text: "/task" } }, ["text", "event.text"])).toBe("/task");
  });

  it("maps chat turns into channel-neutral outbound messages", () => {
    const response: ChatTurnResponse = {
      session: {},
      message: {
        id: "msg",
        role: "assistant",
        content: "Hello",
        createdAt: "2026-07-01T00:00:00.000Z",
        cards: []
      }
    };

    expect(toChannelOutbound("slack", response)).toEqual({
      channel: "slack",
      text: "Hello",
      cards: []
    });
  });
});
