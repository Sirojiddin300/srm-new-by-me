import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("settings").first();
  },
});

export const save = mutation({
  args: {
    instanceId: v.string(),
    apiToken: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("settings").first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        instanceId: args.instanceId,
        apiToken: args.apiToken,
      });
    } else {
      await ctx.db.insert("settings", {
        instanceId: args.instanceId,
        apiToken: args.apiToken,
      });
    }
  },
});
