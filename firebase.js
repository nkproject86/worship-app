// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBICgiomKrIjO2mM3H2uqYFUbF0KEvrqDQ",
  authDomain: "worship-app-5f240.firebaseapp.com",
  projectId: "worship-app-5f240",
  storageBucket: "worship-app-5f240.firebasestorage.app",
  messagingSenderId: "528545319250",
  appId: "1:528545319250:web:704f40514da1b01999528b",
  measurementId: "G-XGWLPF8MG4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);