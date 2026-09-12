import { useChat } from "@ai-sdk/react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  Loader2,
  LogOut,
  MessageSquarePlus,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { NovaMark, NovaWordmark } from "@/components/nova/brand";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme-provider";
import { THEMES, isThemeId } from "@/lib/themes";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat with Nova" },
      { name: "description", content: "Your saved Nova conversations, themes and assistant settings." },
      { property: "og:title", content: "Chat with Nova" },
      { property: "og:description", content: "Pick up your saved conversations with Nova." },
    ],
  }),
  component: ChatPage,
});

type ChatRow = { id: string; title: string; updated_at: string };

const PERSONAS = [
  { id: "balanced", name: "Balanced" },
  { id: "concise", name: "Concise" },
  { id: "creative", name: "Creative" },
  { id: "technical", name: "Technical" },
];

function textOf(message: UIMessage) {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function ChatPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const [chats, setChats] = useState<ChatRow[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [persona, setPersona] = useState("balanced");
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const activeChatRef = useRef<string | null>(null);
  activeChatRef.current = activeChat;

  const { messages, setMessages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: async ({ message }) => {
      const chatId = activeChatRef.current;
      const content = textOf(message);
      if (!chatId || !user || !content) return;
      await supabase.from("messages").insert({
        chat_id: chatId,
        user_id: user.id,
        role: "assistant",
        content,
      });
      await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
    },
    onError: () => toast.error("Nova couldn't reply just now. Try again."),
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const loadChats = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("chats")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false });
    setChats(data ?? []);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void loadChats();
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name,theme")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.display_name) setDisplayName(data.display_name);
      if (isThemeId(data?.theme)) setTheme(data.theme);
    })();
  }, [user, loadChats, setTheme]);

  const openChat = useCallback(
    async (chatId: string) => {
      setActiveChat(chatId);
      const { data } = await supabase
        .from("messages")
        .select("id,role,content")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });
      setMessages(
        (data ?? []).map((row) => ({
          id: row.id,
          role: row.role === "assistant" ? "assistant" : "user",
          parts: [{ type: "text" as const, text: row.content }],
        })) as UIMessage[],
      );
    },
    [setMessages],
  );

  function newChat() {
    setActiveChat(null);
    setMessages([]);
  }

  async function deleteChat(chatId: string) {
    await supabase.from("chats").delete().eq("id", chatId);
    if (activeChat === chatId) newChat();
    void loadChats();
  }

  async function onSubmit(message: PromptInputMessage) {
    const text = message.text.trim();
    if (!text || !user) return;

    let chatId = activeChat;
    if (!chatId) {
      const { data, error: createError } = await supabase
        .from("chats")
        .insert({ user_id: user.id, title: text.slice(0, 60) })
        .select("id,title,updated_at")
        .single();
      if (createError || !data) {
        toast.error("Could not start a new chat.");
        return;
      }
      chatId = data.id;
      setActiveChat(chatId);
      activeChatRef.current = chatId;
      setChats((prev) => [data, ...prev]);
    }

    await supabase.from("messages").insert({
      chat_id: chatId,
      user_id: user.id,
      role: "user",
      content: text,
    });

    sendMessage({ text }, { body: { persona } });
  }

  async function saveTheme(next: string) {
    if (!isThemeId(next)) return;
    setTheme(next);
    if (user) await supabase.from("profiles").update({ theme: next }).eq("id", user.id);
  }

  async function saveName() {
    if (!user) return;
    setSavingName(true);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", user.id);
    setSavingName(false);
    toast[updateError ? "error" : "success"](
      updateError ? "Couldn't save your name." : "Saved.",
    );
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center aurora">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }


  return (
    <main className="relative flex h-screen overflow-hidden">
      {/* Mobile scrim */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={() => setSidebarOpen(false)}
        className={`fixed inset-0 z-30 bg-background/70 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col overflow-hidden border-r border-border bg-surface/80 backdrop-blur-xl transition-all duration-300 ease-out md:relative md:z-auto md:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0 md:w-72 md:opacity-100"
            : "-translate-x-full md:w-0 md:border-r-0 md:opacity-0"
        }`}
      >
        <div className="flex w-72 flex-1 flex-col p-4">
          <div className="flex items-center justify-between">
            <Link to="/">
              <NovaWordmark />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Hide conversations"
              onClick={() => setSidebarOpen(false)}
            >
              <PanelLeftClose className="size-4" />
            </Button>
          </div>
          <Button className="mt-5 w-full" onClick={newChat}>
            <MessageSquarePlus className="size-4" />
            New chat
          </Button>
          <div className="mt-4 flex-1 space-y-1 overflow-y-auto">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`group flex items-center gap-1 rounded-xl px-3 py-2 text-sm transition-all duration-200 hover:translate-x-0.5 ${
                  activeChat === chat.id ? "bg-accent text-foreground" : "hover:bg-accent/60"
                }`}
              >
                <button
                  type="button"
                  className="flex-1 truncate text-left"
                  onClick={() => {
                    void openChat(chat.id);
                    if (isMobile) setSidebarOpen(false);
                  }}
                >
                  {chat.title}
                </button>
                <button
                  type="button"
                  aria-label="Delete chat"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => void deleteChat(chat.id)}
                >
                  <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
            {chats.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">No conversations yet.</p>
            )}
          </div>
          <SettingsDialog
            theme={theme}
            onTheme={saveTheme}
            persona={persona}
            onPersona={setPersona}
            displayName={displayName}
            onDisplayName={setDisplayName}
            onSaveName={saveName}
            savingName={savingName}
          />
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-2 border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={sidebarOpen ? "Hide conversations" : "Show conversations"}
              onClick={() => setSidebarOpen((open) => !open)}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="size-4" />
              ) : (
                <PanelLeftOpen className="size-4" />
              )}
            </Button>
            <div className="flex items-center gap-2 md:hidden">
              <NovaMark size={24} />
              <span className="font-display font-semibold">Nova</span>
            </div>
            <span className="hidden truncate text-sm text-muted-foreground md:block">
              {activeChat ? chats.find((c) => c.id === activeChat)?.title : "New conversation"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="New chat"
                className="md:hidden"
                onClick={newChat}
              >
                <MessageSquarePlus className="size-4" />
              </Button>
            )}
            <div className="md:hidden">
              <SettingsDialog
                theme={theme}
                onTheme={saveTheme}
                persona={persona}
                onPersona={setPersona}
                displayName={displayName}
                onDisplayName={setDisplayName}
                onSaveName={saveName}
                savingName={savingName}
                compact
              />
            </div>
          </div>

        </header>

        <Conversation>
          <ConversationContent className="mx-auto w-full max-w-3xl">
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<NovaMark size={56} className="rise" />}
                title="Ask Nova anything"
                description="Answers stream in as they're written, and every chat is saved to your account."
              />
            ) : (
              messages.map((message) => (
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    <MessageResponse>{textOf(message)}</MessageResponse>
                  </MessageContent>
                </Message>
              ))
            )}
            {error && (
              <p className="text-center text-sm text-destructive">
                Nova hit a snag. Send your message again.
              </p>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="mx-auto w-full max-w-3xl px-4 pb-6">
          <PromptInput onSubmit={onSubmit}>
            <PromptInputBody>
              <PromptInputTextarea placeholder="Message Nova…" />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <Select value={persona} onValueChange={setPersona}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSONAS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PromptInputTools>
              <PromptInputSubmit status={status} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </section>
    </main>
  );
}

function SettingsDialog({
  theme,
  onTheme,
  persona,
  onPersona,
  displayName,
  onDisplayName,
  onSaveName,
  savingName,
  compact,
}: {
  theme: string;
  onTheme: (value: string) => void;
  persona: string;
  onPersona: (value: string) => void;
  displayName: string;
  onDisplayName: (value: string) => void;
  onSaveName: () => void;
  savingName: boolean;
  compact?: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={compact ? "ghost" : "outline"} size={compact ? "sm" : "default"} className={compact ? "" : "mt-3 w-full"}>
          <Settings className="size-4" />
          {!compact && "Settings"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Your name, the look of the app, and how Nova replies.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="display-name">Display name</Label>
          <div className="flex gap-2">
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => onDisplayName(e.target.value)}
              placeholder="Alex"
            />
            <Button onClick={onSaveName} disabled={savingName}>
              Save
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Reply style</Label>
          <Select value={persona} onValueChange={onPersona}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERSONAS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <Palette className="size-4" />
            <Label>Theme</Label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onTheme(t.id)}
                className={`rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 ${
                  theme === t.id ? "border-primary bg-accent glow-ring" : "border-border bg-surface/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t.name}</span>
                  {theme === t.id && <Sparkle className="size-4 text-primary" />}
                </div>
                <div className="mt-3 flex gap-1.5">
                  {t.swatch.map((c) => (
                    <span
                      key={c}
                      className="h-5 flex-1 rounded-full border border-border"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            void supabase.auth.signOut();
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </DialogContent>
    </Dialog>
  );
}
