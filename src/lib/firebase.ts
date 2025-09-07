import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCXB4YFohr7QVd8he9QmuASesyvGiNqsAc",
  authDomain: "gramtalk-fec30.firebaseapp.com",
  databaseURL: "https://gramtalk-fec30-default-rtdb.firebaseio.com",
  projectId: "gramtalk-fec30",
  storageBucket: "gramtalk-fec30.firebasestorage.app",
  messagingSenderId: "156529274764",
  appId: "1:156529274764:web:1677de6463faef1801b0a9"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getDatabase(app);
