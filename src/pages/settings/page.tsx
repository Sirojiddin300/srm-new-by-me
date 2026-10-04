import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { toast } from "sonner";
import { CheckCircle, AlertCircle, RefreshCw, Wifi, Bug, Download } from "lucide-react";
import { downloadSourceZip } from "@/lib/download-zip.ts";

const schema = z.object({
  instanceId: z.string().min(1, "Instance ID талаб карда мешавад"),
  apiToken: z.string().min(1, "API токен талаб карда мешавад"),
});

type FormValues = z.infer<typeof schema>;

export default function SettingsPage() {
  const settings = useQuery(api.settings.get, {});
  const saveSettings = useMutation(api.settings.save);
  const getState = useAction(api.greenApi.getInstanceState);
  const fetchChats = useAction(api.greenApi.fetchChats);
  const debugRaw = useAction(api.greenApi.debugGetChatsRaw);

  const [instanceState, setInstanceState] = useState<string | null>(null);
  const [checkingState, setCheckingState] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ count: number; totalFromApi: number; sampleChat: string } | null>(null);
  const [debugOutput, setDebugOutput] = useState<string | null>(null);
  const [debugging, setDebugging] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      instanceId: "",
      apiToken: "",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        instanceId: settings.instanceId ?? "",
        apiToken: settings.apiToken ?? "",
      });
    }
  }, [settings, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      await saveSettings(values);
      toast.success("Танзимот сабт шуд");
    } catch {
      toast.error("Хатогии сабт");
    }
  };

  const checkState = async () => {
    const values = form.getValues();
    if (!values.instanceId || !values.apiToken) {
      toast.error("Аввал маълумотро ворид кунед");
      return;
    }
    setCheckingState(true);
    try {
      const result = await getState({ instanceId: values.instanceId, apiToken: values.apiToken });
      setInstanceState(result.stateInstance);
    } catch {
      setInstanceState("error");
    } finally {
      setCheckingState(false);
    }
  };

  const syncChats = async () => {
    const values = form.getValues();
    if (!values.instanceId || !values.apiToken) {
      toast.error("Аввал маълумотро ворид кунед");
      return;
    }
    await saveSettings(values).catch(() => {});
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await fetchChats({ instanceId: values.instanceId, apiToken: values.apiToken });
      setSyncResult({ count: result.count, totalFromApi: result.totalFromApi, sampleChat: result.sampleChat });
      if (result.totalFromApi === 0) {
        toast.error("Green API 0 чат баргардонд. Instance-ро санҷед.");
      } else if (result.count === 0) {
        toast.warning(`API ${result.totalFromApi} чат дод, аммо ҳеҷ кадом филтрро нагузашт.`);
      } else {
        toast.success(`${result.count} аз ${result.totalFromApi} чат синхронизатсия шуд`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Синхронизатсия нашуд");
    } finally {
      setSyncing(false);
    }
  };

  const runDebug = async () => {
    const values = form.getValues();
    if (!values.instanceId || !values.apiToken) {
      toast.error("Аввал маълумотро ворид кунед");
      return;
    }
    setDebugging(true);
    setDebugOutput(null);
    try {
      const result = await debugRaw({ instanceId: values.instanceId, apiToken: values.apiToken });
      setDebugOutput(`Ҳамагӣ чатҳо аз Green API: ${result.count}\n\nЯкуми посух:\n${result.raw}`);
    } catch (e) {
      setDebugOutput(`Хато: ${e instanceof Error ? e.message : "Хатои номаълум"}`);
    } finally {
      setDebugging(false);
    }
  };

  const stateColor = () => {
    if (!instanceState) return "";
    if (instanceState === "authorized") return "bg-green-500/15 text-green-400 border-green-500/30";
    if (instanceState === "notAuthorized") return "bg-red-500/15 text-red-400 border-red-500/30";
    return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Танзимот</h1>
          <p className="text-sm text-muted-foreground mt-1">Green API WhatsApp интегратсия</p>
        </div>

        {/* Credentials */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Green API маълумот</CardTitle>
            <CardDescription>Instance ID ва API Token аз console.green-api.com</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="instanceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instance ID</FormLabel>
                      <FormControl>
                        <Input placeholder="1234567890" className="bg-input border-border" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="apiToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Token</FormLabel>
                      <FormControl>
                        <Input placeholder="токени API" type="password" className="bg-input border-border" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">Сабт кардан</Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Download source code */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Зеркашии коди манбаъ</CardTitle>
            <CardDescription>Тамоми коди сайтро ҳамчун ZIP зеркашӣ кунед</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="secondary"
              className="w-full gap-2"
              onClick={async () => {
                try {
                  toast.info("ZIP тайёр мешавад...");
                  await downloadSourceZip("21asr-crm-source.zip");
                  toast.success("Зеркашӣ оғоз шуд!");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Хатогии зеркашӣ");
                }
              }}
            >
              <Download className="w-4 h-4" />
              Зеркашии кодбаза (.zip)
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Файлҳои src/, convex/, index.html, package.json ва ғайра дохил мешаванд
            </p>
          </CardContent>
        </Card>

        {/* Connection & Sync */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Пайваст ва синхронизатсия</CardTitle>
            <CardDescription>Пайвасти Green API-ро санҷед ва чатҳоро синхронизатсия кунед</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={checkState} disabled={checkingState} className="gap-2">
                <Wifi className={`w-4 h-4 ${checkingState ? "animate-spin" : ""}`} />
                Санҷиши пайваст
              </Button>
              {instanceState && (
                <Badge className={stateColor()}>
                  {instanceState === "authorized" ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                  {instanceState === "authorized" ? "Пайваст аст" : instanceState}
                </Badge>
              )}
            </div>

            <Button onClick={syncChats} disabled={syncing} className="gap-2 w-full">
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Синхронизатсия..." : "Синхронизатсияи чатҳо"}
            </Button>

            {syncResult !== null && (
              <div className="space-y-1">
                <p className="text-sm text-center font-medium text-primary">
                  {syncResult.count > 0
                    ? `✓ ${syncResult.count} аз ${syncResult.totalFromApi} чат бор шуд`
                    : `API ${syncResult.totalFromApi} чат дод, 0 филтрро гузашт`}
                </p>
                {syncResult.totalFromApi > 0 && syncResult.count === 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer">Сохтори чат нишон диҳед</summary>
                    <pre className="mt-2 p-2 bg-background rounded text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap border border-border">
                      {syncResult.sampleChat}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="border-t border-border pt-3 mt-2">
              <Button variant="secondary" onClick={runDebug} disabled={debugging} className="gap-2 w-full">
                <Bug className={`w-4 h-4 ${debugging ? "animate-spin" : ""}`} />
                Debug: Raw API посух
              </Button>
              {debugOutput && (
                <pre className="mt-3 p-3 bg-background rounded-lg text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap border border-border max-h-64 overflow-y-auto">
                  {debugOutput}
                </pre>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
