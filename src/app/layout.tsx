import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://voiceforge.app"),
  title: {
    default: "VoiceForge — Озвучивание текста на 15 языках",
    template: "%s · VoiceForge",
  },
  description:
    "Бесплатный онлайн-сервис озвучивания текста на 15 языках, включая русский, английский и китайский. 3 движка TTS, 298 нейроголосов freetts.ru, настраиваемые параметры, скачивание в MP3/WAV.",
  keywords: [
    "озвучивание текста",
    "TTS",
    "text to speech",
    "синтез речи",
    "русский TTS",
    "китайский TTS",
    "английский TTS",
    "VoiceForge",
    "freetts",
    "нейроголоса",
    "MP3 из текста",
    "аудиокнига",
  ],
  authors: [{ name: "VoiceForge" }],
  creator: "VoiceForge",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "VoiceForge — Озвучивание текста на 15 языках",
    description:
      "Бесплатный онлайн-сервис озвучивания текста. 3 движка TTS, 298 нейроголосов, скачивание в MP3/WAV.",
    siteName: "VoiceForge",
    type: "website",
    locale: "ru_RU",
    url: "https://voiceforge.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "VoiceForge — TTS на 15 языках",
    description:
      "Бесплатный онлайн-сервис озвучивания текста на 15 языках. 3 движка, 298 голосов.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* Structured data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "VoiceForge",
              description:
                "Бесплатный онлайн-сервис озвучивания текста на 15 языках. 3 движка TTS, 298 нейроголосов freetts.ru.",
              applicationCategory: "MultimediaApplication",
              operatingSystem: "Any",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "RUB",
              },
              featureList: [
                "15 языков в интерфейсе",
                "298 нейроголосов freetts.ru на 57 языках",
                "3 движка TTS: Web Speech, freetts.ru, Z.ai SDK",
                "Скачивание аудио в MP3/WAV",
                "Настраиваемые скорость, тон, громкость",
                "История озвучиваний с экспортом",
                "Тёмная и светлая темы",
              ],
              url: "https://voiceforge.app",
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
