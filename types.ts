// Import Timestamp type if you want to use it directly in your interfaces,
// otherwise, keep as string and handle conversion in service layer.
// For simplicity, we'll keep them as strings for now and let the service layer
// handle conversions to/from Firestore Timestamps where necessary.

export enum UserRole {
  STAFF = "STAFF",
  WORKER = "WORKER",
}

export enum AlertStatus {
  NEW = "NEW",
  PROCESSED = "PROCESSED",
}

export interface User {
  id: string; // Document ID from Firestore. For users, this IS the uid.
  uid: string; // Firebase Auth UID, and it's used as the document ID.
  username?: string; 
  email?: string; 
  fullName: string;
  phone: string;
  areaCode?: string; // Worker Zone
  role: UserRole;
  createdAt?: string; // Store as ISO string, serverTimestamp on creation
  updatedAt?: string; // Store as ISO string, serverTimestamp on update
  // Password is not stored in Firestore user document if using Firebase Auth
}

export interface EmergencyContact {
  // These can be subcollection items or an array within TargetGroup document
  id: string; // Can be auto-generated or a meaningful ID
  name: string;
  phone: string;
  relationship: string; 
}

export interface TargetGroup { // Represents a Patient
  id: string; // Firestore document ID
  name: string;
  idCard: string;
  address: string;
  dateOfBirth: string; // Store as ISO string, convert to/from Timestamp for Firestore
  gender: 'Male' | 'Female' | 'Other'; 
  photoUrl?: string;
  emergencyContacts: EmergencyContact[]; // Array of contacts
  createdAt: string; // Store as ISO string, serverTimestamp on creation
  createdBy: string; // User UID (from Auth)
}

export interface VitalSign {
  id: string; // Firestore document ID
  patientId: string; // TargetGroup ID (links to patient document)
  bloodPressureSys: number;
  bloodPressureDia: number;
  heartRate: number;
  temperature: number;
  dtx?: number; // Added in previous step
  symptoms?: string;
  comment?: string;
  photoUrl?: string; 
  recordDate: string; // Store as ISO string, serverTimestamp on creation
  recordedBy: string; // User UID (Worker, from Auth)
  isCritical?: boolean; // Determined by checkVitalsAndCreateAlert
}

export interface Alert {
  id: string; // Firestore document ID
  vitalSignId: string;
  patientId: string; 
  patientName: string; // Denormalized for easier display
  message: string; 
  diagnosis?: string;
  recommendation?: string; 
  status: AlertStatus;
  createdAt: string; // Store as ISO string, serverTimestamp on creation
  staffId?: string; // Staff User UID (from Auth) who processed
  workerId: string; // Worker User UID (from Auth) who recorded the vital
  processedAt?: string; // Store as ISO string, serverTimestamp on update
}

export interface VitalThresholds {
  // This will likely be a single document in a 'settings' collection
  maxSystolic: number;
  minSystolic: number;
  maxDiastolic: number;
  minDiastolic: number; 
  maxHeartRate: number;
  minHeartRate: number; 
  maxTemperature: number;
  minTemperature: number; 
  maxDtx?: number; // Added in previous step
  minDtx?: number; // Added in previous step
}

export interface NavigationItem {
  name: string;
  path: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactNode;
  role?: UserRole[]; 
}

// AuthState for current mock auth setup in App.tsx
export interface AuthState {
  currentUserData: User | null; // Will be fetched from Firestore 'users' collection
  isLoading: boolean;
  error: Error | null;
}

export interface StaffRecommendation {
  id: string; // Alert ID
  patientId: string;
  patientName: string;
  recommendationText: string;
  staffName: string;
  date: string; // ISO date string
}