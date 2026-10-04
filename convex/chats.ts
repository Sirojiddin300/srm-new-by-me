import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("chats")
      .withIndex("by_lastMessageTimestamp")
      .order("desc")
      .take(100);
  },
});

export const getById = query({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chats")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .first();
  },
});

export const upsert = mutation({
  args: {
    chatId: v.string(),
    name: v.string(),
    lastMessage: v.optional(v.string()),
    lastMessageTime: v.optional(v.string()),
    lastMessageTimestamp: v.optional(v.number()),
    unreadCount: v.number(),
    isGroup: v.boolean(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("chats")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .first();

    const today = new Date().toISOString().split("T")[0];

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        lastMessage: args.lastMessage,
        lastMessageTime: args.lastMessageTime,
        lastMessageTimestamp: args.lastMessageTimestamp,
        unreadCount: args.unreadCount,
        avatarUrl: args.avatarUrl,
      });
    } else {
      await ctx.db.insert("chats", {
        chatId: args.chatId,
        name: args.name,
        lastMessage: args.lastMessage,
        lastMessageTime: args.lastMessageTime,
        lastMessageTimestamp: args.lastMessageTimestamp,
        unreadCount: args.unreadCount,
        isNewLead: true,
        firstSeenDate: today,
        isGroup: args.isGroup,
        avatarUrl: args.avatarUrl,
      });
    }
  },
});

// Update only last message without overwriting name
export const updateLastMessage = mutation({
  args: {
    chatId: v.string(),
    lastMessage: v.string(),
    lastMessageTime: v.string(),
    lastMessageTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("chats")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        lastMessage: args.lastMessage,
        lastMessageTime: args.lastMessageTime,
        lastMessageTimestamp: args.lastMessageTimestamp,
      });
    }
  },
});

export const setTyping = mutation({
  args: { chatId: v.string(), isTyping: v.boolean() },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .first();
    if (chat) {
      await ctx.db.patch(chat._id, {
        isTyping: args.isTyping,
        // typing auto-expires after 5 seconds (checked in frontend)
        typingUntil: args.isTyping ? Date.now() + 5000 : undefined,
      });
    }
  },
});

export const markRead = mutation({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .first();
    if (chat) {
      await ctx.db.patch(chat._id, { unreadCount: 0 });
    }
  },
});

// Stats for analytics
export const getLeadsByDate = query({
  args: {},
  handler: async (ctx) => {
    const chats = await ctx.db.query("chats").collect();
    const byDate: Record<string, number> = {};
    for (const chat of chats) {
      const date = chat.firstSeenDate;
      byDate[date] = (byDate[date] ?? 0) + 1;
    }
    return byDate;
  },
});

export const getTodayLeadsCount = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];
    const chats = await ctx.db
      .query("chats")
      .withIndex("by_firstSeenDate", (q) => q.eq("firstSeenDate", today))
      .collect();
    return chats.length;
  },
});
