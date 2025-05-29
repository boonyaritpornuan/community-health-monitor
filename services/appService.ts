
import { 
    User, TargetGroup, VitalSign, Alert, 
    UserRole, AlertStatus, VitalThresholds, StaffRecommendation 
} from '../types';
import { db, serverTimestamp, Timestamp } from '../firebase'; // Import Firestore instance and Timestamp helpers
import { 
    collection, getDocs, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, 
    query, where, orderBy, limit as firestoreLimit, writeBatch 
} from 'firebase/firestore';
import { DEFAULT_VITAL_THRESHOLDS } from '../constants';


// --- Helper to convert Firestore Timestamps to ISO strings ---
const timestampToIsoString = (timestamp: any): string | undefined => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  if (typeof timestamp === 'string') return timestamp; // Already a string
  return undefined;
};

const convertDocumentData = <T extends { id: string }>(docSnap: any): T => {
    const data = docSnap.data();
    // Convert Timestamps back to ISO strings for dates
    if (data.createdAt) data.createdAt = timestampToIsoString(data.createdAt);
    if (data.updatedAt) data.updatedAt = timestampToIsoString(data.updatedAt);
    if (data.dateOfBirth) data.dateOfBirth = timestampToIsoString(data.dateOfBirth); // Assuming DOB is stored as Timestamp or needs conversion
    if (data.recordDate) data.recordDate = timestampToIsoString(data.recordDate);
    if (data.processedAt) data.processedAt = timestampToIsoString(data.processedAt);
    return { ...data, id: docSnap.id } as T;
};


// --- Firestore Service Functions ---

// Users
export const getUsers = async (): Promise<User[]> => {
  const usersCol = collection(db, 'users');
  const userSnapshot = await getDocs(usersCol);
  return userSnapshot.docs.map(docSnap => convertDocumentData<User>(docSnap));
};

export const getUserById = async (uid: string): Promise<User | undefined> => {
  if (!uid) return undefined;
  const userDocRef = doc(db, 'users', uid); // Assuming uid is the document ID
  const userSnap = await getDoc(userDocRef);
  return userSnap.exists() ? convertDocumentData<User>(userSnap) : undefined;
};

export const createUser = async (userData: Omit<User, 'id' | 'uid' | 'createdAt'>): Promise<User> => {
  const usersCol = collection(db, 'users');
  // Add 'uid' to the data being saved in Firestore if it's meant to be stored.
  // If User.uid is purely the doc ID, then it doesn't need to be in the document body itself.
  // Assuming userData contains all fields of User except id, uid, createdAt.
  const docRef = await addDoc(usersCol, { ...userData, createdAt: serverTimestamp() });
  
  // Construct the full User object to return, including the generated id and uid.
  // And ensure all fields from userData are correctly typed.
  const newUser: User = {
    ...(userData as Omit<User, 'id' | 'uid' | 'createdAt'>), // Spread known fields
    id: docRef.id,
    uid: docRef.id, // Assuming uid is the same as the document id
    createdAt: new Date().toISOString(),
  };
  return newUser;
};

export const updateUser = async (uid: string, updates: Partial<User>): Promise<User | null> => {
  if (!uid) return null;
  const userDocRef = doc(db, 'users', uid); // Assuming uid is the document ID
  await updateDoc(userDocRef, { ...updates, updatedAt: serverTimestamp() });
  const updatedUser = await getUserById(uid);
  return updatedUser || null;
};

export const deleteUser = async (uid: string): Promise<boolean> => {
  if (!uid) return false;
  const userDocRef = doc(db, 'users', uid); // Assuming uid is the document ID
  await deleteDoc(userDocRef);
  return true;
};

// Target Groups (Patients)
export const getTargetGroups = async (): Promise<TargetGroup[]> => {
  const patientsCol = collection(db, 'patients');
  const q = query(patientsCol, orderBy('name'));
  const patientSnapshot = await getDocs(q);
  return patientSnapshot.docs.map(docSnap => convertDocumentData<TargetGroup>(docSnap));
};

export const getTargetGroupById = async (id: string): Promise<TargetGroup | undefined> => {
  if (!id) return undefined;
  const patientDocRef = doc(db, 'patients', id);
  const patientSnap = await getDoc(patientDocRef);
  return patientSnap.exists() ? convertDocumentData<TargetGroup>(patientSnap) : undefined;
};

export const createTargetGroup = async (patientData: Omit<TargetGroup, 'id' | 'createdAt'>): Promise<TargetGroup> => {
  const patientsCol = collection(db, 'patients');
  const dataToSave = {
    ...patientData,
    dateOfBirth: patientData.dateOfBirth ? Timestamp.fromDate(new Date(patientData.dateOfBirth)) : null,
    createdAt: serverTimestamp()
  };
  const docRef = await addDoc(patientsCol, dataToSave);
  // For returning, convert timestamp back to string if needed by UI immediately
  return { 
    ...patientData, 
    id: docRef.id, 
    createdAt: new Date().toISOString(),
    // dateOfBirth remains string as passed in for immediate return consistency
  } as TargetGroup;
};

export const updateTargetGroup = async (id: string, updates: Partial<TargetGroup>): Promise<TargetGroup | null> => {
  if (!id) return null;
  const patientDocRef = doc(db, 'patients', id);
  const dataToUpdate: any = { ...updates, updatedAt: serverTimestamp() };
  if (updates.dateOfBirth) {
    dataToUpdate.dateOfBirth = Timestamp.fromDate(new Date(updates.dateOfBirth));
  }
  await updateDoc(patientDocRef, dataToUpdate);
  const updatedPatient = await getTargetGroupById(id);
  return updatedPatient || null;
};

export const deleteTargetGroup = async (id: string): Promise<boolean> => {
  if (!id) return false;
  const patientDocRef = doc(db, 'patients', id);
  await deleteDoc(patientDocRef);
  // Optionally, delete related vitals and alerts (cascade delete)
  // This can be complex; consider Cloud Functions for robust cascade deletes.
  // Basic client-side cascade:
  const vitalsQuery = query(collection(db, 'vitalsigns'), where('patientId', '==', id));
  const vitalsSnapshot = await getDocs(vitalsQuery);
  const batch = writeBatch(db);
  vitalsSnapshot.docs.forEach(docSnap => batch.delete(docSnap.ref));
  const alertsQuery = query(collection(db, 'alerts'), where('patientId', '==', id));
  const alertsSnapshot = await getDocs(alertsQuery);
  alertsSnapshot.docs.forEach(docSnap => batch.delete(docSnap.ref));
  await batch.commit();
  return true;
};

// Vital Signs
let currentVitalThresholds: VitalThresholds = { ...DEFAULT_VITAL_THRESHOLDS }; // Cache thresholds

// Helper to get or initialize vital thresholds
const getEnsuredVitalThresholds = async (): Promise<VitalThresholds> => {
    const thresholdsDocRef = doc(db, 'settings', 'vitalThresholds');
    const docSnap = await getDoc(thresholdsDocRef);
    if (docSnap.exists()) {
        currentVitalThresholds = docSnap.data() as VitalThresholds;
        return currentVitalThresholds;
    } else {
        // If not exists, save default and return them
        await setDoc(thresholdsDocRef, DEFAULT_VITAL_THRESHOLDS);
        currentVitalThresholds = { ...DEFAULT_VITAL_THRESHOLDS };
        return currentVitalThresholds;
    }
};
getEnsuredVitalThresholds(); // Initialize on load

const checkVitalsAndCreateAlertFirestore = (vital: VitalSign, thresholds: VitalThresholds, patientName: string): Omit<Alert, 'id' | 'createdAt'> | null => {
  let message = '';
  if (vital.bloodPressureSys > thresholds.maxSystolic) message += 'High Systolic BP. ';
  if (vital.bloodPressureSys < thresholds.minSystolic) message += 'Low Systolic BP. ';
  if (vital.bloodPressureDia > thresholds.maxDiastolic) message += 'High Diastolic BP. ';
  if (vital.bloodPressureDia < thresholds.minDiastolic) message += 'Low Diastolic BP. ';
  if (vital.heartRate > thresholds.maxHeartRate) message += 'High Heart Rate. ';
  if (vital.heartRate < thresholds.minHeartRate) message += 'Low Heart Rate. ';
  if (vital.temperature > thresholds.maxTemperature) message += 'High Temperature. ';
  if (vital.temperature < thresholds.minTemperature) message += 'Low Temperature. ';
  if (vital.dtx && thresholds.maxDtx && vital.dtx > thresholds.maxDtx) message += 'High DTX. ';
  if (vital.dtx && thresholds.minDtx && vital.dtx < thresholds.minDtx) message += 'Low DTX. ';
  
  (vital as any).isCritical = !!message; // Modify vital in place for return

  if (message) {
    return {
      vitalSignId: vital.id,
      patientId: vital.patientId,
      patientName: patientName, // Denormalized
      message: message.trim(),
      status: AlertStatus.NEW,
      workerId: vital.recordedBy,
    };
  }
  return null;
};

export const getVitalSignsForPatient = async (patientId: string): Promise<VitalSign[]> => {
  const vitalsCol = collection(db, 'vitalsigns');
  const q = query(vitalsCol, where('patientId', '==', patientId), orderBy('recordDate', 'desc'));
  const vitalSnapshot = await getDocs(q);
  return vitalSnapshot.docs.map(docSnap => convertDocumentData<VitalSign>(docSnap));
};

export const getVitalSignsRecordedByWorker = async (workerId: string, count: number = 5): Promise<VitalSign[]> => {
    const vitalsCol = collection(db, 'vitalsigns');
    const q = query(vitalsCol, where('recordedBy', '==', workerId), orderBy('recordDate', 'desc'), firestoreLimit(count));
    const vitalSnapshot = await getDocs(q);
    return vitalSnapshot.docs.map(docSnap => convertDocumentData<VitalSign>(docSnap));
};

export const recordVitalSign = async (vitalData: Omit<VitalSign, 'id' | 'isCritical'>): Promise<{vital: VitalSign, alert: Alert | null}> => {
  const vitalsCol = collection(db, 'vitalsigns');
  const dataToSave = {
    ...vitalData,
    recordDate: serverTimestamp() 
  };
  const docRef = await addDoc(vitalsCol, dataToSave);
  const savedVitalData = { ...vitalData, id: docRef.id, recordDate: new Date().toISOString() } as VitalSign;

  // Check for alert
  await getEnsuredVitalThresholds(); // Make sure thresholds are up-to-date
  const patient = await getTargetGroupById(savedVitalData.patientId);
  let createdAlert: Alert | null = null;
  const alertData = checkVitalsAndCreateAlertFirestore(savedVitalData, currentVitalThresholds, patient?.name || 'Unknown Patient');
  
  if (alertData) {
    const alertsCol = collection(db, 'alerts');
    const alertDocRef = await addDoc(alertsCol, { ...alertData, createdAt: serverTimestamp() });
    createdAlert = { ...alertData, id: alertDocRef.id, createdAt: new Date().toISOString() } as Alert;
  }
  
  // Update the vital sign with isCritical if an alert was generated
  if (alertData && (savedVitalData as any).isCritical) {
    const vitalDocRef = doc(db, 'vitalsigns', savedVitalData.id);
    await updateDoc(vitalDocRef, { isCritical: true });
    savedVitalData.isCritical = true;
  }

  return { vital: savedVitalData, alert: createdAlert };
};

// Alerts
export const getAlerts = async (status?: AlertStatus): Promise<Alert[]> => {
  const alertsCol = collection(db, 'alerts');
  let q;
  if (status) {
    q = query(alertsCol, where('status', '==', status), orderBy('createdAt', 'desc'));
  } else {
    q = query(alertsCol, orderBy('createdAt', 'desc'));
  }
  const alertSnapshot = await getDocs(q);
  return alertSnapshot.docs.map(docSnap => convertDocumentData<Alert>(docSnap));
};

export const getAlertById = async (id: string): Promise<Alert | undefined> => {
  if (!id) return undefined;
  const alertDocRef = doc(db, 'alerts', id);
  const alertSnap = await getDoc(alertDocRef);
  return alertSnap.exists() ? convertDocumentData<Alert>(alertSnap) : undefined;
};

export const processAlert = async (alertId: string, diagnosis: string, recommendation: string, staffId: string): Promise<Alert | null> => {
  if (!alertId) return null;
  const alertDocRef = doc(db, 'alerts', alertId);
  const dataToUpdate = {
    diagnosis,
    recommendation,
    staffId,
    status: AlertStatus.PROCESSED,
    processedAt: serverTimestamp()
  };
  await updateDoc(alertDocRef, dataToUpdate);
  const updatedAlert = await getAlertById(alertId);
  return updatedAlert || null;
};

// Settings
export const getVitalThresholds = async (): Promise<VitalThresholds> => {
  return getEnsuredVitalThresholds();
};

export const updateVitalThresholds = async (thresholds: Partial<VitalThresholds>): Promise<VitalThresholds> => {
  const thresholdsDocRef = doc(db, 'settings', 'vitalThresholds');
  await updateDoc(thresholdsDocRef, thresholds); // Using updateDoc, it will create if not exist with setDoc(..., {merge:true})
  currentVitalThresholds = { ...currentVitalThresholds, ...thresholds };
  return { ...currentVitalThresholds };
};

// Dashboard Stats
export const getDashboardStats = async (): Promise<{ totalPatients: number; newAlerts: number; criticalVitalsToday: number; avgHeartRate: number }> => {
  const patientsSnapshot = await getDocs(collection(db, 'patients'));
  const totalPatients = patientsSnapshot.size;

  const newAlertsQuery = query(collection(db, 'alerts'), where('status', '==', AlertStatus.NEW));
  const newAlertsSnapshot = await getDocs(newAlertsQuery);
  const newAlerts = newAlertsSnapshot.size;

  // For criticalVitalsToday, need to query vitals based on date.
  // Firestore doesn't support date part comparisons directly in queries for `startsWith`.
  // Fetch all critical and filter client-side, or structure date for querying (e.g., YYYY-MM-DD string field).
  // For simplicity, let's fetch recent critical vitals and filter. This is not optimal for large datasets.
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const criticalVitalsQuery = query(collection(db, 'vitalsigns'), 
      where('isCritical', '==', true),
      where('recordDate', '>=', Timestamp.fromDate(startOfToday)),
      where('recordDate', '<', Timestamp.fromDate(endOfToday))
  );
  const criticalVitalsSnapshot = await getDocs(criticalVitalsQuery);
  const criticalVitalsToday = criticalVitalsSnapshot.size;

  // Avg Heart Rate: fetch all vitals or a sample. This can be very inefficient.
  // Consider a Cloud Function to periodically calculate and store this.
  // For now, mock or calculate from a recent sample.
  let avgHeartRate = 0;
  const vitalsSnapshot = await getDocs(query(collection(db, 'vitalsigns'), orderBy('recordDate', 'desc'), firestoreLimit(100)));
  const heartRates = vitalsSnapshot.docs
    .map(docSnap => docSnap.data().heartRate as number)
    .filter(hr => typeof hr === 'number' && hr > 0);
  if (heartRates.length > 0) {
    avgHeartRate = Math.round(heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length);
  }

  return { totalPatients, newAlerts, criticalVitalsToday, avgHeartRate };
};

// Report Export - returns data for client-side Blob construction
export const exportReport = async (type: 'pdf' | 'excel', dataType: 'patients' | 'alerts'): Promise<Blob> => {
  let data;
  let fileName = `${dataType}_report.${type === 'pdf' ? 'pdf' : 'csv'}`;

  if (dataType === 'patients') {
    data = await getTargetGroups();
  } else {
    data = await getAlerts();
  }

  if (!data || data.length === 0) {
    return new Blob(["No data available for export."], { type: 'text/plain' });
  }

  if (type === 'excel') { // CSV
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((row: any) => 
        Object.values(row).map(val => {
            if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
            if (typeof val === 'object' && val !== null) return `"${JSON.stringify(val).replace(/"/g, '""')}"`; // Handle arrays/objects
            return String(val);
        }).join(',')
    ).join('\n');
    const content = `${headers}\n${rows}`;
    return new Blob([content], { type: 'text/csv;charset=utf-8;' });
  } else { // PDF (mock)
    const content = `Mock PDF Report for ${dataType}:\n\n${JSON.stringify(data, null, 2)}`;
    return new Blob([content], { type: 'application/pdf' });
  }
};


export const getStaffRecommendationsForWorker = async (workerId: string, count: number = 5): Promise<StaffRecommendation[]> => {
    const q = query(
        collection(db, 'alerts'),
        where('workerId', '==', workerId),
        where('status', '==', AlertStatus.PROCESSED),
        where('recommendation', '!=', null), // Ensure recommendation exists
        orderBy('processedAt', 'desc'),
        firestoreLimit(count)
    );
    const snapshot = await getDocs(q);
    const recommendations: StaffRecommendation[] = [];

    for (const alertDoc of snapshot.docs) {
        const alertData = convertDocumentData<Alert>(alertDoc);
        let staffName = 'Unknown Staff';
        if (alertData.staffId) {
            const staffUser = await getUserById(alertData.staffId); // getUserById expects document ID (which is user.uid)
            if (staffUser) staffName = staffUser.fullName;
        }
        recommendations.push({
            id: alertData.id, // This is alert's ID
            patientId: alertData.patientId,
            patientName: alertData.patientName,
            recommendationText: alertData.recommendation || "No specific recommendation.",
            staffName: staffName,
            date: alertData.processedAt || alertData.createdAt, // Fallback to createdAt if processedAt is missing
        });
    }
    return recommendations;
};