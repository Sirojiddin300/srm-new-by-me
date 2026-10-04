import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils.ts";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Users, Star } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

type Chat = Doc<"chats">;

type Props = {
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
};

function ChatAvatar({ name, isGroup }: { name: string; isGroup: boolean }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center justify-center w-11 h-11 rounded-full bg-accent text-accent-foreground font-semibold text-sm shrink-0">
      {isGroup ? <Users className="w-5 h-5" /> : initials}
    </div>
  );
}

function ChatItem({
  chat,
  isSelected,
  onClick,
}: {
  chat: Chat;
  isSelected: boolean;
  onClick: () => void;
}) {
  const time = chat.lastMessageTimestamp
    ? formatDistanceToNow(new Date(chat.lastMessageTimestamp * 1000), {
        addSuffix: false,
      })
    : "";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors cursor-pointer text-left border-b border-border/50",
        isSelected && "bg-accent",
      )}
    >
      <div className="relative">
        <ChatAvatar name={chat.name} isGroup={chat.isGroup} />
        {chat.isNewLead && (
          <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center">
            <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm text-foreground truncate">
            {chat.name}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">{time}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground truncate">
            {chat.lastMessage ?? "No messages yet"}
          </span>
          {chat.unreadCount > 0 && (
            <Badge className="text-xs px-1.5 py-0 h-5 bg-primary text-primary-foreground shrink-0">
              {chat.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

export default function ChatList({ selectedChatId, onSelectChat }: Props) {
  const chats = useQuery(api.chats.list, {});
  const todayLeads = useQuery(api.chats.getTodayLeadsCount, {});

  if (chats === undefined) {
    return (
      <div className="space-y-1 p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3">
            <Skeleton className="w-11 h-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-foreground">Chats</h2>
          {todayLeads !== undefined && todayLeads > 0 && (
            <Badge
              variant="secondary"
              className="text-xs gap-1 bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
            >
              <Star className="w-3 h-3 fill-yellow-400" />
              {todayLeads} new today
            </Badge>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6 py-12">
            <Users className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">
              No chats yet
            </p>
            <p className="text-xs text-muted-foreground">
              Connect your Green API instance in Settings to load WhatsApp chats.
            </p>
          </div>
        ) : (
          chats.map((chat) => (
            <ChatItem
              key={chat._id}
              chat={chat}
              isSelected={selectedChatId === chat.chatId}
              onClick={() => onSelectChat(chat.chatId)}
            />
          ))
        )}
      </div>
    </div>
  );
}
