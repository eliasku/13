import {button} from "../graphics/gui.js";
import {
    BloodMode,
    DEFAULT_FRAMERATE_LIMIT,
    hasSettingsFlag,
    setSetting,
    Setting,
    SettingFlag,
    settings,
    toggleSettingsFlag,
} from "../game/settings.js";

export const guiSettingsPanel = (x: number, y: number) => {
    if (
        button("sounds", hasSettingsFlag(SettingFlag.Sound) ? "🔊 SOUNDS: ON" : "🔇 SOUNDS: OFF", x - 50, y - 70, {
            w: 100,
            h: 20,
        })
    ) {
        toggleSettingsFlag(SettingFlag.Sound);
    }
    if (
        button("music", "🎵 MUSIC: " + (hasSettingsFlag(SettingFlag.Music) ? "ON" : "OFF"), x - 50, y - 40, {
            w: 100,
            h: 20,
        })
    ) {
        toggleSettingsFlag(SettingFlag.Music);
    }
    if (
        button("speech", "💬 SPEECH: " + (hasSettingsFlag(SettingFlag.Speech) ? "ON" : "OFF"), x - 50, y - 10, {
            w: 100,
            h: 20,
        })
    ) {
        toggleSettingsFlag(SettingFlag.Speech);
    }

    const bloodModeText = ["️‍🩹 FX: NONE", "🩸 FX: BLOOD", "🎨 FX: PAINT "];
    if (
        button("blood", bloodModeText[settings[Setting.Blood]], x - 65, y + 20, {
            w: 80,
            h: 20,
        })
    ) {
        setSetting(Setting.Blood, ((settings[Setting.Blood] + 1) % 3) as BloodMode);
    }

    let particlesMod = settings[Setting.Particles];
    const particlesText = particlesMod > 0 ? "X" + particlesMod : "OFF";
    if (
        button("particles", "️✨ " + particlesText, x + 25, y + 20, {
            w: 40,
            h: 20,
        })
    ) {
        particlesMod *= 2;
        if (particlesMod <= 0) {
            particlesMod = 0.5;
        }
        if (particlesMod > 4) {
            particlesMod = 0;
        }
        setSetting(Setting.Particles, particlesMod);
    }
    if (
        button("highDPI", "🖥️ HIGH-DPI: " + (hasSettingsFlag(SettingFlag.HighDPI) ? "ON" : "OFF"), x - 85, y + 50, {
            w: 80,
            h: 20,
        })
    ) {
        toggleSettingsFlag(SettingFlag.HighDPI);
    }

    const frameRateCap = settings[Setting.FrameRateCap];
    if (
        button("frameRateCap", "FPS LIMIT: " + (frameRateCap > 0 ? frameRateCap + "hz" : "OFF"), x + 5, y + 50, {
            w: 80,
            h: 20,
        })
    ) {
        setSetting(Setting.FrameRateCap, frameRateCap > 0 ? 0 : DEFAULT_FRAMERATE_LIMIT);
    }
};
