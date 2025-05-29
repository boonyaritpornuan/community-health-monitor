
import * as firebaseApp from 'firebase/app'; // Changed from named import
import { getFirestore, serverTimestamp, Timestamp } from 'firebase/firestore';
// import { getDatabase } from 'firebase/database'; // Uncomment if you plan to use Realtime Database
// import { getAuth } from 'firebase/auth'; // Uncomment if you plan to use Firebase Authentication
// import { getStorage } from 'firebase/storage'; // Uncomment if you plan to use Firebase Storage

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC6ouVqTWZWFZhc3zABi-aUAAZS7KHeDvI",
  authDomain: "help-care-5a062.firebaseapp.com",
  databaseURL: "https://help-care-5a062-default-rtdb.asia-southeast1.firebasedatabase.app", // Included as per user's provided config
  projectId: "help-care-5a062",
  storageBucket: "help-care-5a062.firebasestorage.app", 
  messagingSenderId: "360912202854",
  appId: "1:360912202854:web:0064b0305cad5a366f91a7", 
  measurementId: "G-H3WFZ673K8" 
};

// Initialize Firebase
const app = firebaseApp.initializeApp(firebaseConfig); // Changed to use namespace

// Get Firestore instance
const db = getFirestore(app);

// Get Realtime Database instance (optional)
// const rtdb = getDatabase(app); // Uncomment if needed

// Get Firebase Auth instance (optional)
// const auth = getAuth(app); // Uncomment if needed

// Get Firebase Storage instance (optional)
// const storage = getStorage(app); // Uncomment if needed

export { db, app, serverTimestamp, Timestamp }; // Add rtdb, auth, storage to exports if you use them
