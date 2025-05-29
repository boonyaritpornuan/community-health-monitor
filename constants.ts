import { NavigationItem, UserRole, VitalThresholds, AlertStatus } from './types';
import { DashboardIcon, UsersIcon, PatientsIcon, AlertsIcon, SettingsIcon } from './components/common/UiElements'; // Assuming Icons are in UiElements

export const APP_NAME = "Community Health Monitor";

// Combined navigation items for all roles.
// App.tsx will filter these based on the current user's role.
export const ALL_NAVIGATION_ITEMS: NavigationItem[] = [
  // Staff items
  { name: "Dashboard", path: "/", icon: DashboardIcon, role: [UserRole.STAFF] },
  { name: "Patients", path: "/patients", icon: PatientsIcon, role: [UserRole.STAFF] },
  { name: "Alerts", path: "/alerts", icon: AlertsIcon, role: [UserRole.STAFF] },
  { name: "User Management", path: "/users", icon: UsersIcon, role: [UserRole.STAFF] },
  { name: "Settings", path: "/settings", icon: SettingsIcon, role: [UserRole.STAFF] },

  // Worker items
  // Using distinct paths for worker pages to avoid conflicts if a staff member somehow navigated to a base path
  // that a worker also uses, though role-based component rendering would typically handle this.
  // Clearer separation with distinct paths is often easier to manage.
  { name: "My Dashboard", path: "/worker/dashboard", icon: DashboardIcon, role: [UserRole.WORKER] },
  { name: "View Patients", path: "/worker/patients", icon: PatientsIcon, role: [UserRole.WORKER] },
  // "Record Vitals" itself is an action on a patient, so the patient list serves as the entry point.
];


export const DEFAULT_VITAL_THRESHOLDS: VitalThresholds = {
  maxSystolic: 140,
  minSystolic: 90,
  maxDiastolic: 90,
  minDiastolic: 60,
  maxHeartRate: 100,
  minHeartRate: 60,
  maxTemperature: 37.5,
  minTemperature: 36.0,
};

export const USER_ROLES_OPTIONS = [
  { value: UserRole.STAFF, label: "Staff" },
  { value: UserRole.WORKER, label: "Worker" },
];

export const ALERT_STATUS_OPTIONS = [
  { value: AlertStatus.NEW, label: "New" },
  { value: AlertStatus.PROCESSED, label: "Processed" },
];

export const GENDER_OPTIONS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
];