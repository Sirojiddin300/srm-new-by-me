import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils.ts";
import { Send, RefreshCw, Users, User, Mic, FileText, Image, Video, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { toast } from "sonner";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

type Message = Doc<"messages">;

// ── Voice Recorder ────────────────────────────────────────────────────────────
type VoiceRecorderProps = {
  onSend: (base64: string, fileName: string) => Promise<void>;
  disabled?: boolean;
};

function VoiceRecorder({ onSend, disabled }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [sending, setSending] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Use ogg/opus if supported, fallback to webm
      const mimeType = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "audio/webm";
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Микрофон дастрас нест. Иҷозатро санҷед.");
    }
  };

  const cancelRecording = () => {
    if (mediaRef.current) {
      mediaRef.current.stream.getTracks().forEach((t) => t.stop());
      mediaRef.current.stop();
      mediaRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    chunksRef.current = [];
    setRecording(false);
    setSeconds(0);
  };

  const stopAndSend = () => {
    const mr = mediaRef.current;
    if (!mr) return;
    mr.onstop = async () => {
      const ext = mr.mimeType.includes("ogg") ? "ogg" : "webm";
      const blob = new Blob(chunksRef.current, { type: mr.mimeType });
      mr.stream.getTracks().forEach((t) => t.stop());
      setSending(true);
      try {
        // Convert blob to base64
        const arrayBuf = await blob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuf);
        let binary = "";
        uint8.forEach((b) => { binary += String.fromCharCode(b); });
        const base64 = btoa(binary);
        await onSend(base64, `voice_${Date.now()}.${ext}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Хатогии фиристодан");
      } finally {
        setSending(false);
        setRecording(false);
        setSeconds(0);
        chunksRef.current = [];
      }
    };
    mr.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRef.current = null;
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (sending) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/30">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-xs text-primary font-medium">Фиристода истодааст...</span>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs text-red-600 font-medium w-10">{fmt(seconds)}</span>
        <Button
          size="icon"
          variant="ghost"
          className="w-7 h-7 text-muted-foreground hover:text-destructive"
          onClick={cancelRecording}
          title="Бекор кардан"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          className="w-7 h-7 bg-red-500 hover:bg-red-600 text-white"
          onClick={stopAndSend}
          title="Қатъ ва фиристодан"
        >
          <Square className="w-3 h-3 fill-current" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="icon"
      variant="secondary"
      className="h-10 w-10 shrink-0"
      onClick={startRecording}
      disabled={disabled}
      title="Овозпаём фиристодан"
    >
      <Mic className="w-4 h-4" />
    </Button>
  );
}


// Animated typing dots
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-2.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
        />
      ))}
    </div>
  );
}

// Audio player for voice messages
function AudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play().catch(() => {});
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    setProgress((el.currentTime / el.duration) * 100);
  };

  const handleLoadedMetadata = () => {
    const el = audioRef.current;
    if (el) setDuration(el.duration);
  };

  const handleEnded = () => {
    setPlaying(false);
    setProgress(0);
  };

  const formatTime = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />
      <button
        onClick={toggle}
        className="w-8 h-8 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
      >
        <Mic className="w-4 h-4 text-primary" />
      </button>
      <div className="flex-1 space-y-0.5">
        <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs opacity-60">{formatTime(duration)}</p>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const time = format(new Date(msg.timestamp * 1000), "HH:mm");

  const renderContent = () => {
    const type = msg.type;

    if (type === "audioMessage" || type === "pttMessage") {
      return msg.mediaUrl ? (
        <AudioPlayer url={msg.mediaUrl} />
      ) : (
        <p className="flex items-center gap-1 text-xs italic opacity-70">
          <Mic className="w-3 h-3" /> Овозпаём
        </p>
      );
    }

    if (type === "imageMessage") {
      return (
        <div className="space-y-1">
          {msg.mediaUrl && (
            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={msg.mediaUrl}
                alt="image"
                className="max-w-[220px] rounded-lg object-cover"
              />
            </a>
          )}
          {msg.caption && <p className="text-sm">{msg.caption}</p>}
          {!msg.mediaUrl && (
            <p className="flex items-center gap-1 text-xs italic opacity-70">
              <Image className="w-3 h-3" /> Тасвир
            </p>
          )}
        </div>
      );
    }

    if (type === "videoMessage") {
      return (
        <p className="flex items-center gap-1 text-xs italic opacity-70">
          <Video className="w-3 h-3" /> Видео {msg.caption ? `— ${msg.caption}` : ""}
        </p>
      );
    }

    if (type === "documentMessage") {
      return msg.mediaUrl ? (
        <a
          href={msg.mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm underline underline-offset-2"
        >
          <FileText className="w-4 h-4 shrink-0" />
          {msg.caption ?? "Файл"}
        </a>
      ) : (
        <p className="flex items-center gap-1 text-xs italic opacity-70">
          <FileText className="w-3 h-3" /> {msg.caption ?? "Файл"}
        </p>
      );
    }

    // textMessage or unknown
    if (msg.text) return <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>;
    if (msg.caption) return <p className="whitespace-pre-wrap leading-relaxed">{msg.caption}</p>;
    return <p className="italic text-xs opacity-70">[{type}]</p>;
  };

  return (
    <div className={cn("flex", msg.fromMe ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
          msg.fromMe
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card text-card-foreground rounded-bl-sm border border-border",
        )}
      >
        {!msg.fromMe && msg.senderName && (
          <p className="text-xs font-medium text-primary mb-1">{msg.senderName}</p>
        )}
        {renderContent()}
        <p
          className={cn(
            "text-xs mt-1 text-right",
            msg.fromMe ? "text-primary-foreground/60" : "text-muted-foreground",
          )}
        >
          {time}
        </p>
      </div>
    </div>
  );
}

type Props = {
  chatId: string;
  chat: Doc<"chats"> | null | undefined;
};

export default function ChatWindow({ chatId, chat }: Props) {
  const messages = useQuery(api.messages.listByChat, { chatId });
  const settings = useQuery(api.settings.get, {});
  const markRead = useMutation(api.chats.markRead);
  const sendMessageAction = useAction(api.greenApi.sendMessage);
  const sendVoiceAction = useAction(api.greenApi.sendVoiceMessage);
  const fetchHistory = useAction(api.greenApi.fetchChatHistory);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevCountRef = useRef(0);

  // Stable refs — avoid stale closures in timers
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  const fetchHistoryRef = useRef(fetchHistory);
  useEffect(() => { fetchHistoryRef.current = fetchHistory; }, [fetchHistory]);
  const pollingActiveRef = useRef(false);

  // Check if contact is currently typing (expires after 5s)
  const isContactTyping =
    !!chat?.isTyping && !!chat?.typingUntil && chat.typingUntil > Date.now();

  // Mark as read when chat opens
  useEffect(() => {
    markRead({ chatId });
  }, [chatId, markRead]);

  // Load full history once on mount, then every 3s in background (realtime fallback)
  useEffect(() => {
    setInitialLoading(true);
    const s = settingsRef.current;
    if (s?.instanceId) {
      fetchHistoryRef.current({
        instanceId: s.instanceId,
        apiToken: s.apiToken,
        chatId,
        count: 100,
      })
        .catch(() => {})
        .finally(() => setInitialLoading(false));
    } else {
      setInitialLoading(false);
    }

    // Background polling every 3s — gets latest 30 msgs and inserts any new ones.
    // Convex useQuery is reactive: as soon as a message lands in the DB the
    // component re-renders automatically (no manual state change needed).
    const interval = setInterval(async () => {
      const st = settingsRef.current;
      if (!st?.instanceId || pollingActiveRef.current) return;
      pollingActiveRef.current = true;
      try {
        await fetchHistoryRef.current({
          instanceId: st.instanceId,
          apiToken: st.apiToken,
          chatId,
          count: 30,
        });
      } catch { /* silent */ }
      pollingActiveRef.current = false;
    }, 3000);

    return () => {
      clearInterval(interval);
      pollingActiveRef.current = false;
    };
    // key={chatId} on parent means this component remounts on chat change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Auto-scroll on new messages or typing indicator
  useEffect(() => {
    const count = messages?.length ?? 0;
    if (count > prevCountRef.current || isContactTyping) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevCountRef.current = count;
  }, [messages?.length, isContactTyping]);

  const handleSendVoice = async (base64: string, fileName: string) => {
    if (!settings) return;
    await sendVoiceAction({
      instanceId: settings.instanceId,
      apiToken: settings.apiToken,
      chatId,
      audioBase64: base64,
      fileName,
    });
  };

  const handleSend = async () => {
    if (!text.trim() || !settings) return;
    setSending(true);
    try {
      await sendMessageAction({
        instanceId: settings.instanceId,
        apiToken: settings.apiToken,
        chatId,
        message: text.trim(),
      });
      setText("");
      textareaRef.current?.focus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Хатогии фиристодан");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRefresh = async () => {
    if (!settings) return;
    try {
      await fetchHistory({
        instanceId: settings.instanceId,
        apiToken: settings.apiToken,
        chatId,
        count: 100,
      });
    } catch {
      toast.error("Таърих бор нашуд");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0 bg-card">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent text-accent-foreground font-semibold text-sm">
          {chat?.isGroup ? <Users className="w-5 h-5" /> : <User className="w-5 h-5" />}
        </div>
        <div>
          <p className="font-semibold text-sm text-foreground">
            {chat?.name ?? chatId.split("@")[0]}
          </p>
          <p className="text-xs text-muted-foreground">
            {isContactTyping ? (
              <span className="text-primary animate-pulse">навишта истодааст...</span>
            ) : (
              chatId.split("@")[0]
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto w-8 h-8"
          onClick={handleRefresh}
          title="Таърих"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {(messages === undefined || initialLoading) ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                <Skeleton className={cn("h-10 rounded-2xl", i % 2 === 0 ? "w-2/5" : "w-1/3")} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Паёмҳо нестанд.</p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg._id} msg={msg} />)
        )}

        {/* Typing indicator bubble */}
        {isContactTyping && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm">
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 px-4 py-3 border-t border-border bg-card shrink-0">
        <VoiceRecorder onSend={handleSendVoice} disabled={!settings || sending} />
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            settings ? "Паём нависед... (Enter — фиристодан)" : "Green API-ро дар Танзимот танзим кунед"
          }
          disabled={!settings || sending}
          rows={1}
          className="resize-none min-h-[42px] max-h-32 bg-input border-border text-sm"
        />
        <Button
          onClick={handleSend}
          disabled={!text.trim() || !settings || sending}
          size="icon"
          className="h-10 w-10 shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
