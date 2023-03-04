import {initializeApp} from "firebase/app";
import {getAnalytics, logEvent} from "firebase/analytics";
import {setUserProperties} from "@firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyDByP3CbonmNORkPk_x6KAhcuOlFkMzusk",
    authDomain: "iioi13.firebaseapp.com",
    projectId: "iioi13",
    storageBucket: "iioi13.appspot.com",
    messagingSenderId: "125449924230",
    appId: "1:125449924230:web:087f2e927dc7bb8624eb07",
    measurementId: "G-WR4S7P83G6"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const logScreenView = (screen: string) => {
    logEvent(analytics, "screen_view", {
        firebase_screen: screen,
        firebase_screen_class: screen,
    });
};

export const logUserEvent = (event: string) => {
    logEvent(analytics, event);
};

export const setPlayerName = (name: string) => {
    setUserProperties(analytics, {player_name: name});
};
