// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB0ROaJTykcHpLHlLwANoM_rVwFZaGGAPY",
  authDomain: "login-project-90601.firebaseapp.com",
  projectId: "login-project-90601",
  storageBucket: "login-project-90601.firebasestorage.app",
  messagingSenderId: "560821687281",
  appId: "1:560821687281:web:6f0899543788263198ea50",
  measurementId: "G-K3EL8HNSMD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);