/**
 * Configuration for 15 supported languages.
 * Each language includes metadata used for selection, voice filtering,
 * and sample text for preview.
 */

export interface LanguageConfig {
  /** BCP 47 language tag, e.g. "ru-RU" */
  code: string;
  /** ISO 639-1 code, e.g. "ru" */
  iso: string;
  /** English name */
  name: string;
  /** Native name (endonym) */
  nativeName: string;
  /** Flag emoji for visual identification */
  flag: string;
  /** Short sample text used to demonstrate the voice */
  sample: string;
  /**
   * freetts.ru language code (ISO 639-1 prefix used in their voice IDs,
   * e.g. "ru" matches voices "ru-RU001", "ru-RU002" etc.). Used by the
   * freetts engine to filter its static voice catalogue.
   */
  freettsCode: string;
}

export const LANGUAGES: LanguageConfig[] = [
  {
    code: "ru-RU",
    iso: "ru",
    name: "Russian",
    nativeName: "Русский",
    flag: "🇷🇺",
    sample:
      "Привет! Это демонстрация синтеза речи на русском языке. Технология озвучивания текста работает в реальном времени.",
    freettsCode: "ru",
  },
  {
    code: "en-US",
    iso: "en",
    name: "English (US)",
    nativeName: "English (US)",
    flag: "🇺🇸",
    sample:
      "Hello! This is a demonstration of text-to-speech synthesis in American English. The voice sounds natural and clear.",
    freettsCode: "en",
  },
  {
    code: "en-GB",
    iso: "en",
    name: "English (UK)",
    nativeName: "English (UK)",
    flag: "🇬🇧",
    sample:
      "Good day! This is a demonstration of British English text-to-speech synthesis with a refined accent.",
    freettsCode: "en",
  },
  {
    code: "zh-CN",
    iso: "zh",
    name: "Chinese (Simplified)",
    nativeName: "中文（简体）",
    flag: "🇨🇳",
    sample:
      "你好！这是中文文本转语音的演示。语音合成技术可以生成自然流畅的中文朗读效果。",
    freettsCode: "",
  },
  {
    code: "es-ES",
    iso: "es",
    name: "Spanish (Spain)",
    nativeName: "Español (España)",
    flag: "🇪🇸",
    sample:
      "¡Hola! Esta es una demostración de síntesis de voz en español. La tecnología funciona en tiempo real.",
    freettsCode: "es",
  },
  {
    code: "fr-FR",
    iso: "fr",
    name: "French",
    nativeName: "Français",
    flag: "🇫🇷",
    sample:
      "Bonjour ! Ceci est une démonstration de la synthèse vocale en français. La voix générée est naturelle et claire.",
    freettsCode: "fr",
  },
  {
    code: "de-DE",
    iso: "de",
    name: "German",
    nativeName: "Deutsch",
    flag: "🇩🇪",
    sample:
      "Hallo! Dies ist eine Demonstration der Sprachsynthese auf Deutsch. Die Technologie funktioniert in Echtzeit.",
    freettsCode: "de",
  },
  {
    code: "it-IT",
    iso: "it",
    name: "Italian",
    nativeName: "Italiano",
    flag: "🇮🇹",
    sample:
      "Ciao! Questa è una dimostrazione della sintesi vocale in italiano. La voce generata è naturale e chiara.",
    freettsCode: "it",
  },
  {
    code: "pt-BR",
    iso: "pt",
    name: "Portuguese (Brazil)",
    nativeName: "Português (Brasil)",
    flag: "🇧🇷",
    sample:
      "Olá! Esta é uma demonstração de síntese de voz em português brasileiro. A voz soa natural e clara.",
    freettsCode: "pt",
  },
  {
    code: "ja-JP",
    iso: "ja",
    name: "Japanese",
    nativeName: "日本語",
    flag: "🇯🇵",
    sample:
      "こんにちは！これは日本語のテキスト読み上げのデモンストレーションです。自然で明瞭な音声を生成します。",
    freettsCode: "ja",
  },
  {
    code: "ko-KR",
    iso: "ko",
    name: "Korean",
    nativeName: "한국어",
    flag: "🇰🇷",
    sample:
      "안녕하세요! 이것은 한국어 텍스트 음성 변환의 데모입니다. 자연스럽고 명확한 음성이 생성됩니다.",
    freettsCode: "ko",
  },
  {
    code: "ar-SA",
    iso: "ar",
    name: "Arabic",
    nativeName: "العربية",
    flag: "🇸🇦",
    sample:
      "مرحبا! هذه demonstration عرض تحويل النص إلى كلام باللغة العربية. يتم إنشاء صوت طبيعي وواضح.",
    freettsCode: "ar",
  },
  {
    code: "hi-IN",
    iso: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    flag: "🇮🇳",
    sample:
      "नमस्ते! यह हिंदी में टेक्स्ट-टू-स्पीच का प्रदर्शन है। तकनीक वास्तविक समय में काम करती है।",
    freettsCode: "hi",
  },
  {
    code: "tr-TR",
    iso: "tr",
    name: "Turkish",
    nativeName: "Türkçe",
    flag: "🇹🇷",
    sample:
      "Merhaba! Bu, Türkçe metin seslendirme演示 demonstration. Ses doğal ve net bir şekilde üretilir.",
    freettsCode: "tr",
  },
  {
    code: "nl-NL",
    iso: "nl",
    name: "Dutch",
    nativeName: "Nederlands",
    flag: "🇳🇱",
    sample:
      "Hallo! Dit is een demonstratie van tekst-naar-spraak in het Nederlands. De stem klinkt natuurlijk en duidelijk.",
    freettsCode: "nl",
  },
];

/**
 * Get a language config by its BCP 47 code.
 */
export function getLanguageByCode(code: string): LanguageConfig | undefined {
  return LANGUAGES.find((lang) => lang.code === code);
}

/**
 * Get the default language (Russian — primary audience).
 */
export function getDefaultLanguage(): LanguageConfig {
  return LANGUAGES[0];
}
