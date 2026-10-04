import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, subDays, parseISO, startOfDay, endOfDay, eachDayOfInterval } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Users, MessageSquare, Star, TrendingUp, Calendar } from "lucide-react";

const COLORS = [
  "oklch(0.52 0.18 145)",
  "oklch(0.5 0.16 200)",
  "oklch(0.6 0.16 60)",
  "oklch(0.52 0.18 290)",
  "oklch(0.55 0.22 25)",
];

const CHART_TOOLTIP_STYLE = {
  background: "#fff",
  border: "1px solid oklch(0.88 0.006 240)",
  borderRadius: "8px",
  fontSize: 12,
  color: "#111",
};
const GRID_COLOR = "oklch(0.88 0.006 240)";
const TICK_COLOR = "oklch(0.48 0.01 240)";

type Preset = "today" | "yesterday" | "7d" | "14d" | "30d" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Имрӯз" },
  { id: "yesterday", label: "Дирӯз" },
  { id: "7d", label: "7 рӯз" },
  { id: "14d", label: "14 рӯз" },
  { id: "30d", label: "30 рӯз" },
  { id: "custom", label: "Дилхоҳ" },
];

function getPresetRange(p: Preset): { from: string; to: string } {
  const today = format(new Date(), "yyyy-MM-dd");
  if (p === "today") return { from: today, to: today };
  if (p === "yesterday") {
    const y = format(subDays(new Date(), 1), "yyyy-MM-dd");
    return { from: y, to: y };
  }
  if (p === "7d") return { from: format(subDays(new Date(), 6), "yyyy-MM-dd"), to: today };
  if (p === "14d") return { from: format(subDays(new Date(), 13), "yyyy-MM-dd"), to: today };
  if (p === "30d") return { from: format(subDays(new Date(), 29), "yyyy-MM-dd"), to: today };
  return { from: today, to: today };
}

function StatCard({ title, value, icon: Icon, subtitle }: {
  title: string; value: string | number; icon: React.ElementType; subtitle?: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="p-2.5 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const chats = useQuery(api.chats.list, {});
  const leadsByDate = useQuery(api.chats.getLeadsByDate, {});
  const messageStats = useQuery(api.messages.getMessageStats, {});
  const todayLeads = useQuery(api.chats.getTodayLeadsCount, {});

  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const { from, to } = preset === "custom"
    ? { from: customFrom, to: customTo }
    : getPresetRange(preset);

  const dateRange = useMemo(() => {
    try {
      return eachDayOfInterval({
        start: startOfDay(parseISO(from)),
        end: endOfDay(parseISO(to)),
      }).map((d) => format(d, "yyyy-MM-dd"));
    } catch {
      return [format(new Date(), "yyyy-MM-dd")];
    }
  }, [from, to]);

  const isLoading = chats === undefined || leadsByDate === undefined || messageStats === undefined;

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  // Filtered chart data
  const leadsChartData = dateRange.map((date) => ({
    date: dateRange.length <= 14 ? format(parseISO(date), "d MMM") : format(parseISO(date), "d"),
    leads: leadsByDate[date] ?? 0,
  }));

  const messagesChartData = dateRange.map((date) => ({
    date: dateRange.length <= 14 ? format(parseISO(date), "d MMM") : format(parseISO(date), "d"),
    sent: messageStats[date]?.sent ?? 0,
    received: messageStats[date]?.received ?? 0,
  }));

  // Totals for this period
  const periodLeads = dateRange.reduce((s, d) => s + (leadsByDate[d] ?? 0), 0);
  const periodMsgSent = dateRange.reduce((s, d) => s + (messageStats[d]?.sent ?? 0), 0);
  const periodMsgReceived = dateRange.reduce((s, d) => s + (messageStats[d]?.received ?? 0), 0);

  const totalMessages = Object.values(messageStats as Record<string, { sent: number; received: number }>).reduce((acc, d) => acc + d.sent + d.received, 0);

  const groups = chats.filter((c: any) => c.isGroup).length;
  const individuals = chats.length - groups;
  const pieData = [
    { name: "Якка", value: individuals },
    { name: "Гурӯҳ", value: groups },
  ].filter((d) => d.value > 0);

  const topChats = [...chats].sort((a, b) => (b.unreadCount ?? 0) - (a.unreadCount ?? 0)).slice(0, 5);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Аналитика</h1>
          <p className="text-sm text-muted-foreground mt-1">Умумии фаъолияти CRM</p>
        </div>

        {/* Date filter */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              {PRESETS.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant={preset === p.id ? "default" : "secondary"}
                  onClick={() => setPreset(p.id)}
                  className="h-8 text-xs"
                >
                  {p.label}
                </Button>
              ))}
              {preset === "custom" && (
                <div className="flex items-center gap-2 ml-2">
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-8 w-36 text-xs bg-input border-border"
                  />
                  <span className="text-xs text-muted-foreground">—</span>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-8 w-36 text-xs bg-input border-border"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stat cards — period totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Ҳамаи чатҳо" value={chats.length} icon={Users} subtitle="Тамоми вақт" />
          <StatCard title="Лидҳои имрӯза" value={todayLeads ?? 0} icon={Star} subtitle="Имрӯз" />
          <StatCard title="Паёмҳои давра" value={periodMsgSent + periodMsgReceived} icon={MessageSquare} subtitle="Дар давраи интихобшуда" />
          <StatCard title="Лидҳои давра" value={periodLeads} icon={TrendingUp} subtitle="Дар давраи интихобшуда" />
        </div>

        {/* Charts row 1 */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Лидҳои нав</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={leadsChartData}>
                  <defs>
                    <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.52 0.18 145)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="oklch(0.52 0.18 145)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: TICK_COLOR }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: TICK_COLOR }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="leads" stroke="oklch(0.52 0.18 145)" fill="url(#leadsGrad)" strokeWidth={2} name="Лидҳо" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Ҳаҷми паёмҳо</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={messagesChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: TICK_COLOR }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: TICK_COLOR }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="received" fill="oklch(0.52 0.18 145)" radius={[4,4,0,0]} stackId="a" name="Гирифта" />
                  <Bar dataKey="sent" fill="oklch(0.5 0.16 200)" radius={[4,4,0,0]} stackId="a" name="Фиристода" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts row 2 */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">
                Ҳамаи паёмҳо: {totalMessages}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Фиристода</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{periodMsgSent}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Гирифта</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{periodMsgReceived}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Навъи чатҳо</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-12">Чатҳо нестанд</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top chats */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Чатҳои серфаол</CardTitle>
          </CardHeader>
          <CardContent>
            {topChats.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Чатҳо нестанд</p>
            ) : (
              <div className="space-y-2">
                {topChats.map((chat, i) => (
                  <div key={chat._id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                    <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent text-xs font-medium text-accent-foreground">
                      {chat.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{chat.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{chat.lastMessage ?? "Паём нест"}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{chat.unreadCount} нахонда</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
