"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

const BASE_URL = "https://api.green-api.com";

export const fetchChats = action({
  args: {
    instanceId: v.string(),
    apiToken: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; count: number; totalFromApi: number; sampleChat: string }> => {
    const url = `${BASE_URL}/waInstance${args.instanceId}/getChats/${args.apiToken}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Green API error: ${resp.status} — check your Instance ID and API Token`);
    }

    const raw = (await resp.json()) as unknown;

    // getChats can return a plain array or { chats: [...] }
    let chats: Array<Record<string, unknown>> = [];
    if (Array.isArray(raw)) {
      chats = raw as Array<Record<string, unknown>>;
    } else if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      if (Array.isArray(obj.chats)) {
        chats = obj.chats as Array<Record<string, unknown>>;
      }
    }

    // Log the first chat so we know the real field structure
    console.log(`[fetchChats] Total from API: ${chats.length}`);
    if (chats.length > 0) {
      console.log(`[fetchChats] First chat sample:`, JSON.stringify(chats[0]).slice(0, 500));
    }

    // Keep every chat that has ANY indicator of having messages.
    // We are intentionally very permissive here — better to include too many than too few.
    const activeChats = chats.filter((c) => {
      // Has unread messages
      if (Number(c.unreadCount) > 0) return true;
      // Has a lastMessage of any shape
      const lm = c.lastMessage;
      if (lm != null && typeof lm === "object") return true;
      // lastMessage is a non-empty string (some API versions return it as string)
      if (typeof lm === "string" && lm.length > 0) return true;
      // Has a timestamp at root level
      if (c.timestamp != null && Number(c.timestamp) > 0) return true;
      return false;
    });

    console.log(`[fetchChats] Active chats after filter: ${activeChats.length}`);

    for (const chat of activeChats) {
      // Handle lastMessage as object or string
      let lm: Record<string, unknown> = {};
      if (chat.lastMessage != null && typeof chat.lastMessage === "object") {
        lm = chat.lastMessage as Record<string, unknown>;
      }

      // Timestamp: try lastMessage.timestamp, then root timestamp
      const ts = Number(lm.timestamp ?? chat.timestamp ?? 0);

      const typeMessage = String(lm.typeMessage ?? lm.type ?? "textMessage");
      const lastMessageText =
        typeMessage === "textMessage"
          ? ((lm.textMessage as string | undefined) ??
             (typeof chat.lastMessage === "string" ? chat.lastMessage : "") ??
             "")
          : `[${typeMessage}]`;

      const chatId = String(chat.id ?? chat.chatId ?? "");
      if (!chatId) continue;

      const name = String(chat.name ?? chat.chatName ?? chatId.split("@")[0]);

      await ctx.runMutation(api.chats.upsert, {
        chatId,
        name: name || chatId.split("@")[0],
        lastMessage: lastMessageText || undefined,
        lastMessageTime: ts > 0 ? new Date(ts * 1000).toISOString() : undefined,
        lastMessageTimestamp: ts > 0 ? ts : undefined,
        unreadCount: Number(chat.unreadCount ?? 0),
        isGroup:
          typeof chat.isGroup === "boolean"
            ? chat.isGroup
            : chatId.endsWith("@g.us"),
      });
    }

    const sampleChat = chats.length > 0 ? JSON.stringify(chats[0]).slice(0, 300) : "no chats";

    return { success: true, count: activeChats.length, totalFromApi: chats.length, sampleChat };
  },
});

// Receive pending notifications (incoming messages)
export const receiveNotification = action({
  args: {
    instanceId: v.string(),
    apiToken: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ hasMessage: boolean; deleted: boolean }> => {
    try {
      const url = `${BASE_URL}/waInstance${args.instanceId}/receiveNotification/${args.apiToken}`;
      const resp = await fetch(url);
      if (!resp.ok) return { hasMessage: false, deleted: false };

      const data = (await resp.json()) as {
        receiptId?: number;
        body?: Record<string, unknown>;
      } | null;

      if (!data || !data.body) {
        console.log("[receiveNotification] queue empty");
        return { hasMessage: false, deleted: false };
      }

      const body = data.body;
      const receiptId = data.receiptId;

      // Log every webhook so we can see exactly what Green API sends
      console.log("[receiveNotification] typeWebhook:", body.typeWebhook, "| receiptId:", receiptId);
      console.log("[receiveNotification] body:", JSON.stringify(body).slice(0, 600));

      const typeWebhook = body.typeWebhook as string | undefined;
      const isIncoming = typeWebhook === "incomingMessageReceived";
      const isOutgoing =
        typeWebhook === "outgoingMessageReceived" ||
        typeWebhook === "outgoingAPIMessageReceived";

      // Typing indicator
      const isTyping = isIncoming &&
        (body.typeMessage === "typingMessage" ||
         (body.messageData as Record<string, unknown> | undefined)?.typeMessage === "typing");

      const senderData = body.senderData as Record<string, unknown> | undefined;
      const instanceData = (body.instanceData ?? body.chatData) as Record<string, unknown> | undefined;
      const msgData = body.messageData as Record<string, unknown> | undefined;

      if (isTyping) {
        const typingChatId =
          (senderData?.chatId as string | undefined) ??
          (senderData?.sender as string | undefined);
        if (typingChatId) {
          await ctx.runMutation(api.chats.setTyping, { chatId: typingChatId, isTyping: true });
        }
      } else if (isIncoming || isOutgoing) {
        const chatId =
          (senderData?.chatId as string | undefined) ??
          (senderData?.sender as string | undefined) ??
          (instanceData?.chatId as string | undefined) ??
          (body.chatId as string | undefined);

        if (chatId && msgData) {
          const idMessage = (msgData.idMessage as string | undefined) ?? `local_${Date.now()}`;
          const typeMsg = (msgData.typeMessage as string | undefined) ?? "textMessage";

          const textMsgData = msgData.textMessageData as Record<string, unknown> | undefined;
          const extTextData = msgData.extendedTextMessageData as Record<string, unknown> | undefined;
          const imageMsgData = msgData.imageMessageData as Record<string, unknown> | undefined;
          const videoMsgData = msgData.videoMessageData as Record<string, unknown> | undefined;
          const docMsgData = msgData.documentMessageData as Record<string, unknown> | undefined;
          const audioMsgData = msgData.audioMessageData as Record<string, unknown> | undefined;

          const text =
            (textMsgData?.textMessage as string | undefined) ??
            (extTextData?.text as string | undefined) ??
            (imageMsgData?.caption as string | undefined) ??
            (videoMsgData?.caption as string | undefined) ??
            (docMsgData?.caption as string | undefined) ??
            (docMsgData?.fileName as string | undefined);

          const mediaUrl =
            (imageMsgData?.downloadUrl as string | undefined) ??
            (videoMsgData?.downloadUrl as string | undefined) ??
            (audioMsgData?.downloadUrl as string | undefined) ??
            (docMsgData?.downloadUrl as string | undefined);

          const ts = (body.timestamp as number | undefined) ?? Math.floor(Date.now() / 1000);
          const fromMe = isOutgoing;
          const senderName = (senderData?.senderName as string | undefined) ?? (senderData?.chatName as string | undefined);
          const chatName = (senderData?.chatName as string | undefined) ?? (senderData?.senderName as string | undefined) ?? chatId.split("@")[0];

          console.log("[receiveNotification] saving — chatId:", chatId, "type:", typeMsg, "fromMe:", fromMe, "mediaUrl:", mediaUrl);

          await ctx.runMutation(api.messages.insert, {
            chatId,
            messageId: idMessage,
            text,
            fromMe,
            timestamp: ts,
            type: typeMsg,
            mediaUrl,
            senderName: fromMe ? undefined : senderName,
          });

          await ctx.runMutation(api.chats.upsert, {
            chatId,
            name: chatName,
            lastMessage: text ?? `[${typeMsg}]`,
            lastMessageTime: new Date(ts * 1000).toISOString(),
            lastMessageTimestamp: ts,
            unreadCount: fromMe ? 0 : 1,
            isGroup: chatId.endsWith("@g.us"),
          });


        }
      } // end

      // Always delete the notification
      if (receiptId) {
        await fetch(
          `${BASE_URL}/waInstance${args.instanceId}/deleteNotification/${args.apiToken}/${receiptId}`,
          { method: "DELETE" },
        );
        return { hasMessage: true, deleted: true };
      }

      return { hasMessage: !!body.typeWebhook, deleted: false };
    } catch {
      return { hasMessage: false, deleted: false };
    }
  },
});

// Fetch message history for a specific chat
export const fetchChatHistory = action({
  args: {
    instanceId: v.string(),
    apiToken: v.string(),
    chatId: v.string(),
    count: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ count: number }> => {
    try {
      const url = `${BASE_URL}/waInstance${args.instanceId}/getChatHistory/${args.apiToken}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: args.chatId, count: args.count ?? 50 }),
      });
      if (!resp.ok) return { count: 0 };

      const raw = (await resp.json()) as unknown;
      if (!Array.isArray(raw)) return { count: 0 };
      const messages = raw as Array<Record<string, unknown>>;

      for (const msg of messages) {
        const typeMessage = String(msg.typeMessage ?? "textMessage");
        const text =
          typeMessage === "textMessage"
            ? (msg.textMessage as string | undefined)
            : (msg.caption as string | undefined);

        await ctx.runMutation(api.messages.insert, {
          chatId: args.chatId,
          messageId: String(msg.idMessage ?? ""),
          text,
          caption: msg.caption as string | undefined,
          fromMe: msg.type === "outgoing",
          timestamp: Number(msg.timestamp ?? 0),
          type: typeMessage,
          mediaUrl: msg.downloadUrl as string | undefined,
          senderName: msg.senderName as string | undefined,
        });
      }

      return { count: messages.length };
    } catch {
      return { count: 0 };
    }
  },
});

// Send a text message
export const sendMessage = action({
  args: {
    instanceId: v.string(),
    apiToken: v.string(),
    chatId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<{ idMessage: string }> => {
    const url = `${BASE_URL}/waInstance${args.instanceId}/sendMessage/${args.apiToken}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: args.chatId, message: args.message }),
    });
    if (!resp.ok) {
      let errorMsg = `Error ${resp.status}`;
      try {
        const errBody = (await resp.json()) as Record<string, unknown>;
        // Green API quota error shape
        const invokeStatus = errBody.invokeStatus as Record<string, unknown> | undefined;
        const corrStatus = errBody.correspondentsStatus as Record<string, unknown> | undefined;
        if (invokeStatus?.status === "QUOTE_ALLOWED" || corrStatus?.status === "CORRESPONDENTS_QUOTE_EXCEEDED") {
          errorMsg =
            "Green API free plan limit reached. You can only send messages to 3 whitelisted numbers on the Developer (free) plan. Upgrade to the Business plan at console.green-api.com to send to all contacts.";
        } else if (typeof invokeStatus?.description === "string") {
          errorMsg = invokeStatus.description;
        } else if (typeof errBody.message === "string") {
          errorMsg = errBody.message;
        }
      } catch { /* ignore json parse error */ }
      throw new Error(errorMsg);
    }
    const result = (await resp.json()) as { idMessage: string };

    const now = Math.floor(Date.now() / 1000);

    await ctx.runMutation(api.messages.insert, {
      chatId: args.chatId,
      messageId: result.idMessage,
      text: args.message,
      fromMe: true,
      timestamp: now,
      type: "textMessage",
    });

    await ctx.runMutation(api.chats.updateLastMessage, {
      chatId: args.chatId,
      lastMessage: args.message,
      lastMessageTime: new Date(now * 1000).toISOString(),
      lastMessageTimestamp: now,
    });

    return result;
  },
});

// Send a voice message (audio file as base64)
export const sendVoiceMessage = action({
  args: {
    instanceId: v.string(),
    apiToken: v.string(),
    chatId: v.string(),
    audioBase64: v.string(), // base64 encoded audio (webm/ogg)
    fileName: v.string(),
  },
  handler: async (ctx, args): Promise<{ idMessage: string }> => {
    const url = `${BASE_URL}/waInstance${args.instanceId}/sendFileByUpload/${args.apiToken}`;

    // Convert base64 to binary
    const binaryStr = atob(args.audioBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "audio/ogg" });

    const formData = new FormData();
    formData.append("chatId", args.chatId);
    formData.append("caption", "");
    formData.append("file", blob, args.fileName);

    const resp = await fetch(url, { method: "POST", body: formData });
    if (!resp.ok) {
      let msg = `Error ${resp.status}`;
      try {
        const err = (await resp.json()) as Record<string, unknown>;
        if (typeof err.message === "string") msg = err.message;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    const result = (await resp.json()) as { idMessage: string };

    const now = Math.floor(Date.now() / 1000);
    await ctx.runMutation(api.messages.insert, {
      chatId: args.chatId,
      messageId: result.idMessage,
      fromMe: true,
      timestamp: now,
      type: "audioMessage",
    });
    await ctx.runMutation(api.chats.updateLastMessage, {
      chatId: args.chatId,
      lastMessage: "[Овозпаём]",
      lastMessageTime: new Date(now * 1000).toISOString(),
      lastMessageTimestamp: now,
    });
    return result;
  },
});

// Check instance state
export const getInstanceState = action({
  args: {
    instanceId: v.string(),
    apiToken: v.string(),
  },
  handler: async (_ctx, args): Promise<{ stateInstance: string }> => {
    try {
      const url = `${BASE_URL}/waInstance${args.instanceId}/getStateInstance/${args.apiToken}`;
      const resp = await fetch(url);
      if (!resp.ok) return { stateInstance: "error" };
      return (await resp.json()) as { stateInstance: string };
    } catch {
      return { stateInstance: "error" };
    }
  },
});

// Send broadcast message to multiple chats
export const sendBroadcast = action({
  args: {
    instanceId: v.string(),
    apiToken: v.string(),
    chatIds: v.array(v.string()),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<{ sent: number; failed: number }> => {
    let sent = 0;
    let failed = 0;
    for (const chatId of args.chatIds) {
      try {
        const url = `${BASE_URL}/waInstance${args.instanceId}/sendMessage/${args.apiToken}`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, message: args.message }),
        });
        if (!resp.ok) { failed++; continue; }
        const result = (await resp.json()) as { idMessage: string };
        const now = Math.floor(Date.now() / 1000);
        await ctx.runMutation(api.messages.insert, {
          chatId,
          messageId: result.idMessage ?? `bc_${Date.now()}_${chatId}`,
          text: args.message,
          fromMe: true,
          timestamp: now,
          type: "textMessage",
        });
        await ctx.runMutation(api.chats.updateLastMessage, {
          chatId,
          lastMessage: args.message,
          lastMessageTime: new Date(now * 1000).toISOString(),
          lastMessageTimestamp: now,
        });
        sent++;
        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 300));
      } catch { failed++; }
    }
    return { sent, failed };
  },
});

// Debug: return raw API response to diagnose field mapping issues
export const debugGetChatsRaw = action({
  args: {
    instanceId: v.string(),
    apiToken: v.string(),
  },
  handler: async (_ctx, args): Promise<{ raw: string; count: number }> => {
    const url = `${BASE_URL}/waInstance${args.instanceId}/getChats/${args.apiToken}`;
    const resp = await fetch(url);
    const raw = await resp.text();
    let count = 0;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) count = parsed.length;
      else if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.chats)) count = (obj.chats as unknown[]).length;
      }
    } catch { /* ignore */ }
    // Return first 3000 chars so we can see the structure
    return { raw: raw.slice(0, 3000), count };
  },
});
