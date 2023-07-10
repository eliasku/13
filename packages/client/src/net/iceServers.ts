let rtcConfiguration: RTCConfiguration = {};

export const setRtcConfiguration = (config: RTCConfiguration) => {
    rtcConfiguration = config;
};

export const getRtcConfiguration = () => rtcConfiguration;
