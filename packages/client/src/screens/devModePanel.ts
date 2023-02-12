import {button, uiState} from "../graphics/gui.js";
import {hasSettingsFlag, SettingFlag, toggleSettingsFlag} from "../game/settings.js";
import {poki} from "../poki.js";

export const guiDevModePanel = (x: number, y: number) => {
    y -= 70;
    if (
        button("fps", "FPS: " + (hasSettingsFlag(SettingFlag.DevShowFrameStats) ? "ON" : "OFF"), x - 50, y, {
            w: 100,
            h: 16,
        })
    ) {
        toggleSettingsFlag(SettingFlag.DevShowFrameStats);
    }
    y += 20;
    if (
        button(
            "collision",
            "COLLISION: " + (hasSettingsFlag(SettingFlag.DevShowCollisionInfo) ? "ON" : "OFF"),
            x - 50,
            y,
            {
                w: 100,
                h: 16,
            },
        )
    ) {
        toggleSettingsFlag(SettingFlag.DevShowCollisionInfo);
    }
    y += 20;
    if (
        button("console", "LOGS: " + (hasSettingsFlag(SettingFlag.DevLogging) ? "ON" : "OFF"), x - 50, y, {
            w: 100,
            h: 16,
        })
    ) {
        toggleSettingsFlag(SettingFlag.DevLogging);
    }
    y += 20;
    if (
        button("info", "INFO: " + (hasSettingsFlag(SettingFlag.DevShowDebugInfo) ? "ON" : "OFF"), x - 50, y, {
            w: 100,
            h: 16,
        })
    ) {
        toggleSettingsFlag(SettingFlag.DevShowDebugInfo);
    }
    y += 20;
    if (
        button("autoplay", "AUTOPLAY: " + (hasSettingsFlag(SettingFlag.DevAutoPlay) ? "ON" : "OFF"), x - 50, y, {
            w: 100,
            h: 16,
        })
    ) {
        toggleSettingsFlag(SettingFlag.DevAutoPlay);
    }
    y += 20;
    if (
        button("dev_disable", "DISABLE", x - 30, y + 50, {
            w: 60,
            h: 10,
        })
    ) {
        toggleSettingsFlag(SettingFlag.DevMode);
        return true;
    }

    if (
        button("dev_reward_video", "🎬", uiState._width - 20, 10, {
            w: 10,
            h: 20,
        })
    ) {
        poki._rewardedBreak().catch();
    }
    return false;
};
