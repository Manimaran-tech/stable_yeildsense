import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAHoJXFrkQ2zZZqgtcgZaPGp19sJgfR2X8",
    authDomain: "defy-63107.firebaseapp.com",
    projectId: "defy-63107",
    storageBucket: "defy-63107.appspot.com",
    messagingSenderId: "106313724353",
    appId: "1:500862952270:web:2004cfa93e634dcfacf41f"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
