import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { MessagesSquare, Palette, ShieldCheck, Sparkle, Zap } from "lucide-react";

import { NovaMark, NovaWordmark } from "@/components/nova/brand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { THEMES } from "@/lib/themes";
import { useTheme } from "@/lib/theme-provider";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nova — a calmer, faster AI assistant" },
      {
        name: "description",
        content:
          "Nova answers instantly, remembers your conversations, and lets you dress the whole app in the theme you like.",
      },
      { property: "og:title", content: "Nova — a calmer, faster AI assistant" },
      {
        property: "og:description",
        content: "Sign in, start chatting, and pick from six handcrafted themes.",
      },
    ],
  }),
  component: Landing,
});

const section = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.section
      variants={section}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

function Landing() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <main className="min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-20 glass">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <NovaWordmark />
          <nav className="flex items-center gap-2">
            <a
              href="#features"
              className="hidden rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Features
            </a>
            <a
              href="#themes"
              className="hidden rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Themes
            </a>
            <Button asChild size="sm">
              <Link to={user ? "/chat" : "/auth"}>{user ? "Open Nova" : "Sign in"}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <Section className="relative aurora">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-5 py-24 text-center sm:py-32">
          <NovaMark size={92} className="rise drop-shadow-2xl" />
          <h1 className="mt-8 text-4xl font-semibold leading-[1.05] sm:text-6xl">
            Ask anything. <span className="text-gradient">Nova answers.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            A fast, focused AI companion with saved conversations, personal accounts, and six
            themes that change the whole feel of the app in one tap.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="glow-ring">
              <Link to={user ? "/chat" : "/auth"}>
                {user ? "Continue chatting" : "Start chatting free"}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#themes">See the themes</a>
            </Button>
          </div>
        </div>
      </Section>

      <Section className="mx-auto max-w-6xl px-5 py-20" >
        <div id="features" className="grid gap-5 sm:grid-cols-3">
          {[
            {
              icon: Zap,
              title: "Answers as you read",
              body: "Replies stream in word by word, so you never stare at a spinner.",
            },
            {
              icon: MessagesSquare,
              title: "Every chat kept",
              body: "Conversations are saved to your account and picked up on any device.",
            },
            {
              icon: ShieldCheck,
              title: "Yours only",
              body: "Your chats are locked to your account — nobody else can read them.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="glass rounded-2xl p-6 transition-transform hover:-translate-y-1">
              <Icon className="size-5 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="mx-auto max-w-6xl px-5 pb-24">
        <div id="themes" className="glass rounded-3xl p-7 sm:p-10">
          <div className="flex items-center gap-2 text-primary">
            <Palette className="size-5" />
            <span className="text-sm font-medium uppercase tracking-widest">Themes</span>
          </div>
          <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Try one right now</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Tap a theme to preview it live. Once you sign in, your pick is saved to your account.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={`group rounded-2xl border p-4 text-left transition-all hover:-translate-y-1 ${
                  theme === t.id
                    ? "border-primary bg-accent glow-ring"
                    : "border-border bg-surface/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.name}</span>
                  {theme === t.id && <Sparkle className="size-4 text-primary" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t.blurb}</p>
                <div className="mt-4 flex gap-1.5">
                  {t.swatch.map((c) => (
                    <span
                      key={c}
                      className="h-6 flex-1 rounded-full border border-border"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </Section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <NovaWordmark />
          <span>Built for people who like their tools quiet and quick.</span>
        </div>
      </footer>
    </main>
  );
}
