import { useEffect, useRef, useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import ChatList from "./_components/ChatList.tsx";
import ChatWindow from "./_components/ChatWindow.tsx";
import { MessageSquare, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { useNavigate } from "react-router-dom";

export default function CrmPage() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const settings = useQuery(api.settings.get, {});
  const selectedChat = useQuery(
    api.chats.getById,
    selectedChatId ? { chatId: selectedChatId } : "skip",
  );
  const navigate = useNavigate();

  const fetchChats = useAction(api.greenApi.fetchChats);
  const receiveNotification = useAction(api.greenApi.receiveNotification);

  // Keep settings in a ref so the polling interval always has the latest value
  // without needing to recreate the interval on every settings change
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Track if polling is already running to avoid overlapping calls
  const pollingRef = useRef(false);

  // Initial load + periodic refresh of chat LIST every 10s
  useEffect(() => {
    if (!settings?.instanceId) return;
    fetchChats({
      instanceId: settings.instanceId,
      apiToken: settings.apiToken,
    }).catch(() => {});

    const interval = setInterval(() => {
      const s = settingsRef.current;
      if (!s?.instanceId) return;
      fetchChats({ instanceId: s.instanceId, apiToken: s.apiToken }).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.instanceId]);

  // Polling loop — runs every 2s for near-realtime updates.
  // Convex useQuery is reactive: as soon as a message lands in the DB the
  // chat list and chat window re-render automatically — no manual refresh needed.
  useEffect(() => {
    const poll = async () => {
      const s = settingsRef.current;
      if (!s?.instanceId || pollingRef.current) return;
      pollingRef.current = true;
      try {
        const result = await receiveNotification({
          instanceId: s.instanceId,
          apiToken: s.apiToken,
        });
        // If a message arrived, immediately drain the queue
        if (result.hasMessage) {
          pollingRef.current = false;
          await poll();
          return;
        }
      } catch {
        // Silently ignore 429s or network errors
      }
      pollingRef.current = false;
    };

    // Fire once immediately, then every 2 seconds
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  // Only run once on mount — settingsRef keeps it up to date
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (settings === undefined) {
    return null;
  }

  if (!settings) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <MessageSquare className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          WhatsApp пайваст кунед
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Барои қабул ва фиристодани паёмҳои WhatsApp, маълумоти Green API-ро танзим кунед.
        </p>
        <Button onClick={() => navigate("/settings")} className="gap-2">
          <SettingsIcon className="w-4 h-4" />
          Ба Танзимот гузаред
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Chat list panel */}
      <div
        className={`
          ${selectedChatId ? "hidden md:flex" : "flex"}
          flex-col w-full md:w-80 border-r border-border bg-card shrink-0
        `}
      >
        <ChatList
          selectedChatId={selectedChatId}
          onSelectChat={setSelectedChatId}
        />
      </div>

      {/* Chat window */}
      <div
        className={`
          ${selectedChatId ? "flex" : "hidden md:flex"}
          flex-col flex-1 min-w-0
        `}
      >
        {selectedChatId ? (
          <ChatWindow
            key={selectedChatId}
            chatId={selectedChatId}
            chat={selectedChat}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <MessageSquare className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Чатро интихоб кунед
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
