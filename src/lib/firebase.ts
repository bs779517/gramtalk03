import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDExdiaHrb74VnoDQD1wQYOo_MCazKF9WE",
  authDomain: "gramtalk03.firebaseapp.com",
  databaseURL: "https://gramtalk03-default-rtdb.firebaseio.com",
  projectId: "gramtalk03",
  storageBucket: "gramtalk03.firebasestorage.app",
  messagingSenderId: "255381585722",
  appId: "1:255381585722:web:0976e99f7fe47096cd5a03"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getDatabase(app);
