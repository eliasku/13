import {loadJSON} from "../utils/loaders.js";

const translations: Record<string, Record<string, string>> = {};

export const languages = {
    en: "English",
    ru: "Русский",
    de: "Deutsch",
    es: "Española",
    fr: "Française",
    it: "Italiana",
    ja: "日本",
    ko: "한국인",
    pt: "Portugues",
    tr: "Türk",
    zh: "中文",
};

export const map = {
    en: "en",
    ru: "ru",
    de: "de",
    es: "es",
    fr: "fr",
    it: "it",
    ja: "ja",
    ko: "ko",
    pt: "pt-BR",
    tr: "tr",
    zh: "zh-Hans",
};

export const languageFlags = {
    en: "🇬🇧",
    ru: "🇷🇺",
};

export const languagesList = ["en", "de", "es", "ru", "fr", "it", "ja", "ko", "pt", "tr", "zh"];

const initUserLanguage = (): string => {
    let lang = localStorage.getItem("lang");
    if (!lang) {
        if (navigator.language.length >= 2) {
            lang = navigator.language.substring(0, 2);
        }
    }
    return languages[lang] ? lang : "en";
};

let language = initUserLanguage();

const loadTranslation = (lang: string): Promise<unknown> => {
    if (translations[lang]) {
        return Promise.resolve();
    }
    return loadJSON<Record<string, string>>(`translations/${map[lang]}.json`).then(dict => (translations[lang] = dict));
};

export const loadInitialTranslations = (): Promise<unknown> => {
    if (language !== "en") {
        return Promise.all([loadTranslation("en"), loadTranslation(language)]);
    }
    return loadTranslation("en");
};

export const selectTranslation = (lang: string) => {
    language = lang;
    localStorage.setItem("lang", lang);
    loadTranslation(lang);
};

export const getCurrentLanguage = () => language;
export const isTranslationLoading = () => !translations[language];
export const getCurrentLanguageFlag = () => languageFlags[language];

export const L = (key: string) => translations[language]?.[key] ?? translations.en[key] ?? "";
