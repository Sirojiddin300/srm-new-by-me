import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { toast } from "sonner";
import { Send, Users, CheckSquare, Square, Search, Megaphone } from "lucide-react";

export default function BroadcastPage() {
  const chats = useQuery(api.chats.list, {});
  const settings = useQuery(api.settings.get, {});
  const sendBroadcast = useAction(api.greenApi.sendBroadcast);

  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  const filtered = (chats ?? []).filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.chatId.toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = filtered.length > 0 && filtered.every((c: any) => selected.has(c.chatId));

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected);
      filtered.forEach((c: any) => next.delete(c.chatId));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((c: any) => next.add(c.chatId));
      setSelected(next);
    }
  };

  const toggle = (chatId: string) => {
    const next = new Set(selected);
    if (next.has(chatId)) next.delete(chatId);
    else next.add(chatId);
    setSelected(next);
  };

  const handleSend = async () => {
    if (!settings) { toast.error("Аввал Green API-ро танзим кунед"); return; }
    if (!message.trim()) { toast.error("Матни паёмро нависед"); return; }
    if (selected.size === 0) { toast.error("Ҳадди ақал як чат интихоб кунед"); return; }

    setSending(true);
    setResult(null);
    try {
      const res = await sendBroadcast({
        instanceId: settings.instanceId,
        apiToken: settings.apiToken,
        chatIds: Array.from(selected),
        message: message.trim(),
      });
      setResult(res);
      if (res.sent > 0) {
        toast.success(`Расилка тайёр: ${res.sent} фиристода шуд`);
        setMessage("");
        setSelected(new Set());
      } else {
        toast.error("Ягон паём фиристода нашуд");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Хатогии расилка");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Расилка</h1>
            <p className="text-sm text-muted-foreground">Яке паёмро ба якчанд чат фиристодан</p>
          </div>
        </div>

        {/* Message composer */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Матни паём</CardTitle>
            <CardDescription>Ин матн ба ҳамаи чатҳои интихобшуда фиристода мешавад</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Матни расилкаро нависед..."
              rows={5}
              className="bg-input border-border resize-none"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {selected.size > 0
                  ? `${selected.size} чат интихоб шудааст`
                  : "Чат интихоб нашудааст"}
              </p>
              {result && (
                <div className="flex gap-2">
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    ✓ {result.sent} фиристода
                  </Badge>
                  {result.failed > 0 && (
                    <Badge className="bg-red-100 text-red-700 border-red-200">
                      ✗ {result.failed} нашуд
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <Button
              onClick={handleSend}
              disabled={sending || !message.trim() || selected.size === 0 || !settings}
              className="w-full gap-2"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Фиристода истодааст... ({selected.size} чат)
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Ба {selected.size > 0 ? `${selected.size} чат` : "чатҳо"} фиристодан
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Chat selector */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Чатҳоро интихоб кунед
              </CardTitle>
              <Button
                variant="secondary"
                size="sm"
                onClick={toggleAll}
                className="gap-1.5 h-8 text-xs"
              >
                {allSelected ? (
                  <><Square className="w-3.5 h-3.5" /> Ҳамаро бардоштан</>
                ) : (
                  <><CheckSquare className="w-3.5 h-3.5" /> Ҳамаро интихоб</>
                )}
              </Button>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Ҷустуҷӯ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm bg-input border-border"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {chats === undefined ? (
              <p className="text-sm text-muted-foreground text-center py-6">Бор мешавад...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Чатҳо ёфт нашуданд</p>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                {filtered.map((chat: any) => (
                  <label
                    key={chat.chatId}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selected.has(chat.chatId)}
                      onCheckedChange={() => toggle(chat.chatId)}
                    />
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent text-xs font-semibold text-accent-foreground shrink-0">
                      {chat.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{chat.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {chat.lastMessage ?? "Паём нест"}
                      </p>
                    </div>
                    {chat.isGroup && (
                      <Badge variant="secondary" className="text-xs shrink-0">Гурӯҳ</Badge>
                    )}
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
