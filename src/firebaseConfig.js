// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD7IOgntCVZDa7Knx64p_-41kICPElU68c",
  authDomain: "ayoub-ai-4917f.firebaseapp.com",
  databaseURL: "https://ayoub-ai-4917f-default-rtdb.firebaseio.com",
  projectId: "ayoub-ai-4917f",
  storageBucket: "ayoub-ai-4917f.firebasestorage.app",
  messagingSenderId: "114391121759",
  appId: "1:114391121759:web:a9720957c376f6d1e840ea",
  measurementId: "G-46Q49CRJ0S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const database = getDatabase(app);
export default app;