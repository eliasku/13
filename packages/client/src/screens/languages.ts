import {button} from "../graphics/gui.js";
import {getCurrentLanguage, isTranslationLoading, languages, languagesList, selectTranslation} from "../assets/text.js";

export const guiLanguagesPanel = (x: number, y: number) => {
    const currentLang = getCurrentLanguage();
    const loading = isTranslationLoading();
    const symbol = loading ? " ⏳" : " ✓";
    let by = y - 40;
    let i = 0;
    for (const lang of languagesList) {
        let text = languages[lang];
        const px = i % 2 ? x + 5 : x - 105;
        const py = i % 2 ? by - 10 : by;
        if (lang === currentLang) {
            text += symbol;
        }
        if (
            button(lang, text, px, py, {
                w: 100,
                h: 15,
            })
        ) {
            selectTranslation(lang);
        }
        by += 20 / 2;
        ++i;
    }
};
