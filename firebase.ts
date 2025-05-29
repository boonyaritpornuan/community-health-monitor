
import firebase from 'firebase/app'; // Changed: Use default import for v8 compatibility
import 'firebase/firestore'; // Changed: Import for side effects to attach firestore to the firebase object

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC6ouVqTWZWFZhc3zABi-aUAAZS7KHeDvI",
  authDomain: "help-care-5a062.firebaseapp.com",
  databaseURL: "https://help-care-5a062-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "help-care-5a062",
  storageBucket: "help-care-5a062.firebasestorage.app", 
  messagingSenderId: "360912202854",
  appId: "1:360912202854:web:0064b0305cad5a366f91a7", 
  measurementId: "G-H3WFZ673K8" 
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig); // Changed: Call initializeApp on the firebase object

// Get Firestore instance
const db = firebase.firestore(); // Changed: Access firestore via the firebase object

// Export Timestamp and serverTimestamp in a way that matches existing usage from v8 style
const Timestamp = firebase.firestore.Timestamp;
const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp; // This is the serverTimestamp function

export { db, app, serverTimestamp, Timestamp };
