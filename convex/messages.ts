import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByChat = query({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    // Fetch latest 200 messages (desc), then reverse so newest is at bottom
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_chatId_timestamp", (q) => q.eq("chatId", args.chatId))
      .order("desc")
      .take(200);
    return msgs.reverse();
  },
});

export const insert = mutation({
  args: {
    chatId: v.string(),
    messageId: v.string(),
    text: v.optional(v.string()),
    caption: v.optional(v.string()),
    fromMe: v.boolean(),
    timestamp: v.number(),
    type: v.string(),
    mediaUrl: v.optional(v.string()),
    senderName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .first();
    if (existing) return; // deduplicate
    await ctx.db.insert("messages", args);
  },
});

export const getMessageStats = query({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("messages").take(1000);
    const byDate: Record<string, { sent: number; received: number }> = {};
    for (const msg of messages) {
      const date = new Date(msg.timestamp * 1000).toISOString().split("T")[0];
      if (!byDate[date]) byDate[date] = { sent: 0, received: 0 };
      if (msg.fromMe) {
        byDate[date].sent += 1;
      } else {
        byDate[date].received += 1;
      }
    }
    return byDate;
  },
});
