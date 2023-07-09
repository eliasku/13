// export const iceServers = [
//     {
//         urls: "stun:openrelay.metered.ca:80",
//     },
//     {
//         urls: "turn:openrelay.metered.ca:80",
//         username: "openrelayproject",
//         credential: "openrelayproject",
//     },
//     {
//         urls: "turn:openrelay.metered.ca:443",
//         username: "openrelayproject",
//         credential: "openrelayproject",
//     },
//     {
//         urls: "turn:openrelay.metered.ca:443?transport=tcp",
//         username: "openrelayproject",
//         credential: "openrelayproject",
//     },
// ];

let iceServers: RTCIceServer[] = [];

export const loadIceServers = async () => {
    const response = await fetch(
        "https://iioi.metered.live/api/v1/turn/credentials?apiKey=0e3e47445e7c658af0dcb176b91d62671c6f",
    );
    iceServers = (await response.json()) as RTCIceServer[];
};

export const getIceServers = () => iceServers;
