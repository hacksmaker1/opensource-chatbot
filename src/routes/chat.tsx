import { useChat } from "@ai-sdk/react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { DefaultChatTransport, type FileUIPart, type UIMessage } from "ai";
import {
  ImagePlus,
  Loader2,
  LogOut,
  MessageSquarePlus,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Settings,
  Trash2,
  X,
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
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { NovaMark, NovaWordmark } from "@/components/nova/brand";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
type AttachmentMeta = { filename: string; mediaType: string };

const PERSONAS = [
  { id: "balanced", name: "Balanced" },
  { id: "concise", name: "Concise" },
  { id: "creative", name: "Creative" },
  { id: "technical", name: "Technical" },
];

const SUGGESTIONS: string[] = [
  "Explain a tricky idea simply",
  "Help me plan my week",
  "Draft a friendly email",
  "Give me a creative idea",
];

function textOf(message: UIMessage) {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function filesOf(message: UIMessage): FileUIPart[] {
  return message.parts.filter((part): part is FileUIPart => part.type === "file");
}

function AttachmentChips({ files }: { files: { filename?: string; mediaType: string }[] }) {
  if (files.length === 0) return null;
  return (
    <div className="mb-1 flex flex-wrap gap-1.5">
      {files.map((f, i) => (
        <span
          key={`${f.filename}-${i}`}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-0.5 text-xs text-muted-foreground"
        >
          <Paperclip className="size-3" />
          {f.filename ?? "file"}
        </span>
      ))}
    </div>
  );
}

/** Rendered inside <PromptInput> so it can read attachment state. */
function ComposerExtras() {
  const attachments = usePromptInputAttachments();
  return (
    <>
      {attachments.files.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-3">
          {attachments.files.map((file) => (
            <span
              key={file.id}
              className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-accent/60 px-3 py-1 text-xs"
            >
              {file.mediaType.startsWith("image/") ? (
                <img src={file.url} alt={file.filename} className="size-5 rounded-full object-cover" />
              ) : (
                <Paperclip className="size-3" />
              )}
              <span className="max-w-32 truncate">{file.filename}</span>
              <button
                type="button"
                aria-label={`Remove ${file.filename}`}
                onClick={() => attachments.remove(file.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function AttachButton() {
  const attachments = usePromptInputAttachments();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Add photos or files"
      className="rounded-full"
      onClick={() => attachments.openFileDialog()}
    >
      <Paperclip className="size-4" />
    </Button>
  );
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [attachmentMeta, setAttachmentMeta] = useState<Record<string, AttachmentMeta[]>>({});
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

  const refreshAvatarUrl = useCallback(async (path: string | null) => {
    if (!path) {
      setAvatarUrl(null);
      return;
    }
    const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
    setAvatarUrl(data?.signedUrl ?? null);
  }, []);

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
        .select("display_name,theme,avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.display_name) setDisplayName(data.display_name);
      if (isThemeId(data?.theme)) setTheme(data.theme);
      if (data?.avatar_url) {
        setAvatarPath(data.avatar_url);
        void refreshAvatarUrl(data.avatar_url);
      }
    })();
  }, [user, loadChats, setTheme, refreshAvatarUrl]);

  const openChat = useCallback(
    async (chatId: string) => {
      setActiveChat(chatId);
      const { data } = await supabase
        .from("messages")
        .select("id,role,content,attachments")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });
      const meta: Record<string, AttachmentMeta[]> = {};
      setMessages(
        (data ?? []).map((row) => {
          const atts = (row.attachments ?? []) as unknown as AttachmentMeta[];
          if (atts.length > 0) meta[row.id] = atts;
          return {
            id: row.id,
            role: row.role === "assistant" ? "assistant" : "user",
            parts: [
              ...atts.map((a) => ({ type: "file" as const, mediaType: a.mediaType, url: "", filename: a.filename })),
              { type: "text" as const, text: row.content },
            ],
          };
        }) as UIMessage[],
      );
      setAttachmentMeta(meta);
    },
    [setMessages],
  );

  function newChat() {
    setActiveChat(null);
    setMessages([]);
    setAttachmentMeta({});
  }

  async function deleteChat(chatId: string) {
    const { error: deleteError } = await supabase.from("messages").delete().eq("chat_id", chatId);
    if (deleteError) {
      toast.error("Couldn't delete that chat.");
      return;
    }
    await supabase.from("chats").delete().eq("id", chatId);
    if (activeChat === chatId) newChat();
    void loadChats();
    toast.success("Chat deleted.");
  }

  async function onSubmit(message: PromptInputMessage) {
    const text = message.text.trim();
    if ((!text && message.files.length === 0) || !user) return;

    let chatId = activeChat;
    if (!chatId) {
      const { data, error: createError } = await supabase
        .from("chats")
        .insert({ user_id: user.id, title: text.slice(0, 60) || "File upload" })
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

    const atts: AttachmentMeta[] = message.files.map((f) => ({
      filename: f.filename ?? "file",
      mediaType: f.mediaType,
    }));

    await supabase.from("messages").insert({
      chat_id: chatId,
      user_id: user.id,
      role: "user",
      content: text,
      attachments: atts,
    });

    sendMessage(
      { text: text || "Please look at the attached file(s).", files: message.files },
      { body: { persona } },
    );
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

  async function uploadAvatar(file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Please pick an image under 5 MB.");
      return;
    }
    setUploadingAvatar(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      setUploadingAvatar(false);
      toast.error("Couldn't upload your photo.");
      return;
    }
    await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
    setAvatarPath(path);
    await refreshAvatarUrl(path);
    setUploadingAvatar(false);
    toast.success("Profile photo updated.");
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center aurora">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  const settingsProps = {
    theme,
    onTheme: saveTheme,
    persona,
    onPersona: setPersona,
    displayName,
    onDisplayName: setDisplayName,
    onSaveName: saveName,
    savingName,
    avatarUrl,
    uploadingAvatar,
    onUploadAvatar: uploadAvatar,
  };

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
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      aria-label="Delete chat"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
                      <AlertDialogDescription>
                        “{chat.title}” and all its messages will be permanently removed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void deleteChat(chat.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
            {chats.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">No conversations yet.</p>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Avatar className="size-9 border border-border">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="Your profile photo" /> : null}
              <AvatarFallback className="text-xs">
                {(displayName || user.email || "N").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName || "You"}</p>
            </div>
            <SettingsDialog {...settingsProps} compact />
          </div>
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
        </header>

        <Conversation>
          <ConversationContent className="mx-auto w-full max-w-3xl">
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<NovaMark size={56} className="rise" />}
                title="Ask Nova anything"
                description="Answers stream in as they're written, and every chat is saved to your account."
              >
                <NovaMark size={56} className="rise" />
                <div className="space-y-1">
                  <h3 className="font-display text-lg font-semibold">Ask Nova anything</h3>
                  <p className="text-sm text-muted-foreground">
                    Answers stream in as they're written, and every chat is saved to your account.
                  </p>
                </div>
                <div className="mt-2 grid w-full max-w-md gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void onSubmit({ text: s, files: [] } as PromptInputMessage)}
                      className="rounded-2xl border border-border bg-surface/60 px-4 py-3 text-left text-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:bg-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </ConversationEmptyState>
            ) : (
              messages.map((message) => (
                <Message from={message.role} key={message.id} className="rise">
                  <MessageContent>
                    <AttachmentChips
                      files={filesOf(message).length > 0 ? filesOf(message) : (attachmentMeta[message.id] ?? [])}
                    />
                    <MessageResponse>{textOf(message)}</MessageResponse>
                  </MessageContent>
                </Message>
              ))
            )}
            {status === "submitted" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <NovaMark size={18} />
                <Shimmer>Nova is thinking…</Shimmer>
              </div>
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
          <PromptInput
            onSubmit={onSubmit}
            multiple
            className="rounded-3xl border-border bg-surface/70 backdrop-blur-xl transition-shadow duration-300 focus-within:glow-ring"
          >
            <ComposerExtras />
            <PromptInputTextarea placeholder="Message Nova…" />
            <PromptInputFooter>
              <PromptInputTools>
                <AttachButton />
                <Select value={persona} onValueChange={setPersona}>
                  <SelectTrigger className="w-36 rounded-full">
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
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Nova can make mistakes. Double-check anything important.
          </p>
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
  avatarUrl,
  uploadingAvatar,
  onUploadAvatar,
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
  avatarUrl: string | null;
  uploadingAvatar: boolean;
  onUploadAvatar: (file: File) => void;
  compact?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={compact ? "ghost" : "outline"} size={compact ? "icon" : "default"} className={compact ? "rounded-full" : "mt-3 w-full"} aria-label="Settings">
          <Settings className="size-4" />
          {!compact && "Settings"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Your photo, name, the look of the app, and how Nova replies.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Profile photo</Label>
          <div className="flex items-center gap-3">
            <Avatar className="size-14 border border-border">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="Your profile photo" /> : null}
              <AvatarFallback>
                {(displayName || "N").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadAvatar(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              {uploadingAvatar ? "Uploading…" : "Choose photo"}
            </Button>
          </div>
        </div>

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
