import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),

  settings: defineTable({
    instanceId: v.string(),
    apiToken: v.string(),
  }),

  chats: defineTable({
    chatId: v.string(),
    name: v.string(),
    lastMessage: v.optional(v.string()),
    lastMessageTime: v.optional(v.string()),
    lastMessageTimestamp: v.optional(v.number()),
    unreadCount: v.number(),
    isNewLead: v.boolean(),
    firstSeenDate: v.string(),
    avatarUrl: v.optional(v.string()),
    isGroup: v.boolean(),
    isTyping: v.optional(v.boolean()),
    typingUntil: v.optional(v.number()),
  })
    .index("by_chatId", ["chatId"])
    .index("by_lastMessageTimestamp", ["lastMessageTimestamp"])
    .index("by_firstSeenDate", ["firstSeenDate"]),

  messages: defineTable({
    chatId: v.string(),
    messageId: v.string(),
    text: v.optional(v.string()),
    caption: v.optional(v.string()),
    fromMe: v.boolean(),
    timestamp: v.number(), // unix timestamp
    type: v.string(), // "textMessage" | "imageMessage" | "documentMessage" | etc
    mediaUrl: v.optional(v.string()),
    senderName: v.optional(v.string()),
  })
    .index("by_chatId", ["chatId"])
    .index("by_messageId", ["messageId"])
    .index("by_chatId_timestamp", ["chatId", "timestamp"]),
});
