import {button, uiState} from "../graphics/gui.js";
import {
    BloodMode,
    DEFAULT_FRAMERATE_LIMIT,
    hasSettingsFlag,
    setSetting,
    Setting,
    SettingFlag,
    settings,
    toggleSettingsFlag
} from "../game/settings.js";
import {poki} from "../poki.js";

export function guiSettingsPanel(x: number, y: number) {
    if (button("sounds", "🔊 SOUNDS: " + (hasSettingsFlag(SettingFlag.Sound) ? "ON" : "OFF"), x - 50, y - 70, {
        w: 100,
        h: 20
    })) {
        toggleSettingsFlag(SettingFlag.Sound);
    }
    if (button("music", "🎵 MUSIC: " + (hasSettingsFlag(SettingFlag.Music) ? "ON" : "OFF"), x - 50, y - 40, {
        w: 100,
        h: 20
    })) {
        toggleSettingsFlag(SettingFlag.Music);
    }
    if (button("speech", "💬 SPEECH: " + (hasSettingsFlag(SettingFlag.Speech) ? "ON" : "OFF"), x - 50, y - 10, {
        w: 100,
        h: 20
    })) {
        toggleSettingsFlag(SettingFlag.Speech);
    }

    const bloodModeText = ["️‍🩹 FX: NONE", "🩸 FX: BLOOD", "🎨 FX: PAINT "];
    if (button("blood", bloodModeText[settings[Setting.Blood]], x - 65, y + 20, {
        w: 80,
        h: 20
    })) {
        setSetting(Setting.Blood, ((settings[Setting.Blood] + 1) % 3) as BloodMode);
    }

    let particlesMod = settings[Setting.Particles];
    const particlesText = particlesMod > 0 ? ("X" + particlesMod) : "OFF";
    if (button("particles", "️✨ " + particlesText, x + 25, y + 20, {
        w: 40,
        h: 20
    })) {
        particlesMod *= 2;
        if (particlesMod <= 0) {
            particlesMod = 0.5;
        }
        if (particlesMod > 4) {
            particlesMod = 0;
        }
        setSetting(Setting.Particles, particlesMod);
    }
    if (button("highDPI", "🖥️ HIGH-DPI: " + (hasSettingsFlag(SettingFlag.HighDPI) ? "ON" : "OFF"), x - 85, y + 50, {
        w: 80,
        h: 20
    })) {
        toggleSettingsFlag(SettingFlag.HighDPI);
    }

    const frameRateCap = settings[Setting.FrameRateCap];
    if (button("frameRateCap", "FPS LIMIT: " + (frameRateCap > 0 ? (frameRateCap + "hz") : "OFF"), x + 5, y + 50, {
        w: 80,
        h: 20
    })) {
        setSetting(Setting.FrameRateCap, frameRateCap > 0 ? 0 : DEFAULT_FRAMERATE_LIMIT);
    }
}

export function guiDevModePanel(x: number, y: number) {
    y -= 70;
    if (button("fps", "FPS: " + (hasSettingsFlag(SettingFlag.DevShowFrameStats) ? "ON" : "OFF"), x - 50, y, {
        w: 100,
        h: 16
    })) {
        toggleSettingsFlag(SettingFlag.DevShowFrameStats);
    }
    y += 20;
    if (button("collision", "COLLISION: " + (hasSettingsFlag(SettingFlag.DevShowCollisionInfo) ? "ON" : "OFF"), x - 50, y, {
        w: 100,
        h: 16
    })) {
        toggleSettingsFlag(SettingFlag.DevShowCollisionInfo);
    }
    y += 20;
    if (button("console", "LOGS: " + (hasSettingsFlag(SettingFlag.DevLogging) ? "ON" : "OFF"), x - 50, y, {
        w: 100,
        h: 16
    })) {
        toggleSettingsFlag(SettingFlag.DevLogging);
    }
    y += 20;
    if (button("info", "INFO: " + (hasSettingsFlag(SettingFlag.DevShowDebugInfo) ? "ON" : "OFF"), x - 50, y, {
        w: 100,
        h: 16
    })) {
        toggleSettingsFlag(SettingFlag.DevShowDebugInfo);
    }
    y += 20;
    if (button("autoplay", "AUTOPLAY: " + (hasSettingsFlag(SettingFlag.DevAutoPlay) ? "ON" : "OFF"), x - 50, y, {
        w: 100,
        h: 16
    })) {
        toggleSettingsFlag(SettingFlag.DevAutoPlay);
    }
    y += 20;
    if (button("dev_disable", "DISABLE", x - 30, y + 50, {
        w: 60,
        h: 10
    })) {
        toggleSettingsFlag(SettingFlag.DevMode);
        return true;
    }

    if (button("dev_reward_video", "🎬", uiState._width - 20, 10, {
        w: 10,
        h: 20
    })) {
        poki._rewardedBreak().catch();
    }
    return false;
}