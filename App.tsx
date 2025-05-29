import React, { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, NavLink, useLocation, Link, Navigate, useNavigate } from 'react-router-dom';
import { User, UserRole, NavigationItem, AuthState } from './types';
import * as api from './services/appService'; // Use appService for mock data
import { APP_NAME, ALL_NAVIGATION_ITEMS } from './constants';
import { 
    DashboardPage as StaffDashboardPage,
    PatientsPage as StaffPatientsPage, 
    PatientDetailPage as StaffPatientDetailPage, 
    AlertsPage as StaffAlertsPage, 
    UserManagementPage as StaffUserManagementPage, 
    SettingsPage as StaffSettingsPage 
} from './components/PageViews';
import { 
    WorkerDashboardPage, 
    WorkerPatientsListPage, 
    WorkerRecordVitalsPage 
} from './components/worker/WorkerPageViews';
// LoginPage is removed
import { ChevronDownIcon, ChevronUpIcon, Spinner, Button } from './components/common/UiElements';

// Simplified Auth Context for mock user
const AppAuthContext = createContext<{ currentUserData: User | null; setCurrentUser: (user: User | null) => void; isLoading: boolean } | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AppAuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AppAuthProvider');
  }
  return context;
};

const AppAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Simulate initial loading

  // Simulate fetching initial user (e.g., default to staff or worker for dev)
  useEffect(() => {
    const fetchInitialUser = async () => {
      setIsLoading(true);
      // For development, default to the first staff user or worker user
      const users = await api.getUsers();
      if (users && users.length > 0) {
         // Default to staff01 for dev convenience
        const defaultUser = users.find(u => u.username === 'staff01') || users.find(u => u.role === UserRole.STAFF) || users[0];
        setCurrentUserData(defaultUser);
      }
      setIsLoading(false);
    };
    fetchInitialUser();
  }, []);

  const setCurrentUser = (user: User | null) => {
    setCurrentUserData(user);
  };

  return (
    <AppAuthContext.Provider value={{ currentUserData, setCurrentUser, isLoading }}>
      {children}
    </AppAuthContext.Provider>
  );
};

// Simplified Protected Route Component
const ProtectedRoute: React.FC<{ children: JSX.Element; roles?: UserRole[] }> = ({ children, roles }) => {
  const { currentUserData, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>;
  }

  if (!currentUserData) {
    // In a real app with a login page, we would redirect to /login
    // For this mock version, if no user, perhaps show a message or default to a role-less view (not applicable here)
    // Or simply don't render, which shouldn't happen if App.tsx handles initial user setting
    return <div className="p-6 text-center">Please select a user role using the developer toggle.</div>;
  }
  
  if (roles && !roles.includes(currentUserData.role)) {
    // If user's role is not allowed, redirect to their default page
    const defaultPath = currentUserData.role === UserRole.WORKER ? "/worker/dashboard" : "/";
    return <Navigate to={defaultPath} state={{ from: location }} replace />;
  }

  return children;
};


// Main App Component
const AppContent: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentUserData, setCurrentUser, isLoading } = useAuth();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [allMockUsers, setAllMockUsers] = useState<User[]>([]);
  const location = useLocation();
  const navigate = useNavigate();


  useEffect(() => {
    api.getUsers().then(setAllMockUsers);
  }, []);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleUserDropdown = () => setUserDropdownOpen(!userDropdownOpen);

  const handleUserSwitch = (userId: string) => {
    const userToSwitch = allMockUsers.find(u => u.uid === userId);
    if (userToSwitch) {
      setCurrentUser(userToSwitch);
      setUserDropdownOpen(false);
      // Navigate to default page for the new role
      const landingPath = userToSwitch.role === UserRole.WORKER ? "/worker/dashboard" : "/";
      navigate(landingPath);
    }
  };
  
  const accessibleNavItems = currentUserData ? ALL_NAVIGATION_ITEMS.filter(item =>
    item.role?.includes(currentUserData.role)
  ) : [];

  const landingPath = currentUserData?.role === UserRole.WORKER ? "/worker/dashboard" : "/";

  let currentPageName = "Overview";
  const matchedNavItem = accessibleNavItems.find(item => item.path === location.pathname || (location.pathname === "/" && item.path === landingPath));
  if (matchedNavItem) {
    currentPageName = matchedNavItem.name;
  } else if (currentUserData?.role === UserRole.STAFF) {
    if (location.pathname.startsWith('/patients/')) currentPageName = "Patient Details";
  } else if (currentUserData?.role === UserRole.WORKER) {
    if (location.pathname.startsWith('/worker/record-vitals/')) currentPageName = "Record Vitals";
  }


  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /> <span className="ml-4 text-xl">Loading App...</span></div>;
  }
  
  // No currentUserData means app is still loading or user selection is needed
  if (!currentUserData) {
     return (
        <div className="p-6 text-center">
            <h1 className="text-2xl font-semibold">No User Selected</h1>
            <p className="mt-2 text-gray-600">Please use the developer dropdown to select a user role to view the app.</p>
            {/* Render a simple user switcher if no user is selected, useful for initial load */}
            <div className="mt-4">
                <select 
                    onChange={(e) => handleUserSwitch(e.target.value)} 
                    defaultValue=""
                    className="p-2 border rounded"
                >
                    <option value="" disabled>Select a user...</option>
                    {allMockUsers.map(u => <option key={u.uid} value={u.uid}>{u.fullName} ({u.role})</option>)}
                </select>
            </div>
        </div>
    );
  }


  return (
    <div className="flex h-screen bg-gray-100">
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-800 text-slate-100 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:flex md:flex-col`}>
        <div className="flex items-center justify-center h-20 border-b border-slate-700">
          <Link to={landingPath} className="text-2xl font-bold text-white">{APP_NAME}</Link>
        </div>
        <nav className="flex-grow p-4 space-y-2">
          {accessibleNavItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === "/" || item.path === "/worker/dashboard"} 
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 group
                 ${isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`
              }
              onClick={sidebarOpen ? toggleSidebar : undefined} 
            >
              <item.icon className="w-5 h-5 mr-3 text-slate-400 group-hover:text-slate-200" />
              {item.name}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700 text-xs text-slate-400 text-center">
          &copy; {new Date().getFullYear()} {APP_NAME}
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200 shadow-sm">
          <button onClick={toggleSidebar} className="text-gray-500 focus:outline-none focus:text-gray-700 md:hidden">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 6H20M4 12H20M4 18H11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="text-lg font-medium text-gray-700 md:ml-2">
            {currentPageName}
          </div>
            
          <div className="relative">
            {currentUserData && (
              <div>
                <button onClick={toggleUserDropdown} className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 p-1 bg-gray-200 hover:bg-gray-300">
                  <img className="h-8 w-8 rounded-full object-cover" src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserData.fullName)}&background=random&size=40`} alt={currentUserData.fullName} />
                  <span className="hidden md:inline-block ml-2 text-gray-700">{currentUserData.fullName} ({currentUserData.role})</span>
                  {userDropdownOpen ? <ChevronUpIcon className="w-4 h-4 ml-1 hidden md:inline-block text-gray-600"/> : <ChevronDownIcon className="w-4 h-4 ml-1 hidden md:inline-block text-gray-600"/> }
                </button>
              </div>
            )}
            {userDropdownOpen && currentUserData && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg py-1 z-20 ring-1 ring-black ring-opacity-5">
                <div className="px-4 py-3 border-b">
                    <p className="text-sm font-medium text-gray-900">{currentUserData.fullName}</p>
                    <p className="text-xs text-gray-500">{currentUserData.email || currentUserData.username}</p>
                    <p className="text-xs font-medium text-gray-700">Current Role: {currentUserData.role}</p>
                </div>
                <div className="px-4 py-2">
                    <label htmlFor="userSwitch" className="block text-xs font-medium text-gray-700 mb-1">Switch User (Dev):</label>
                    <select 
                        id="userSwitch"
                        value={currentUserData.uid} 
                        onChange={(e) => handleUserSwitch(e.target.value)}
                        className="w-full p-2 border rounded-md text-sm"
                    >
                        {allMockUsers.map(u => <option key={u.uid} value={u.uid}>{u.fullName} ({u.role})</option>)}
                    </select>
                </div>
                {/* A simple logout/clear user button for the mock setup */}
                <button 
                    onClick={() => setCurrentUser(null)} // Clears the current user, showing the "select user" screen
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t"
                >
                  Clear Current User (Dev)
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
          <Routes>
            {/* Routes are protected by ProtectedRoute component */}
            <Route path="/" element={<ProtectedRoute roles={[UserRole.STAFF]}><StaffDashboardPage /></ProtectedRoute>} />
            <Route path="/patients" element={<ProtectedRoute roles={[UserRole.STAFF]}><StaffPatientsPage /></ProtectedRoute>} />
            <Route path="/patients/:patientId" element={<ProtectedRoute roles={[UserRole.STAFF]}><StaffPatientDetailPage /></ProtectedRoute>} />
            <Route path="/alerts" element={<ProtectedRoute roles={[UserRole.STAFF]}><StaffAlertsPage /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute roles={[UserRole.STAFF]}><StaffUserManagementPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute roles={[UserRole.STAFF]}><StaffSettingsPage /></ProtectedRoute>} />

            <Route path="/worker/dashboard" element={<ProtectedRoute roles={[UserRole.WORKER]}><WorkerDashboardPage /></ProtectedRoute>} />
            <Route path="/worker/patients" element={<ProtectedRoute roles={[UserRole.WORKER]}><WorkerPatientsListPage /></ProtectedRoute>} />
            <Route path="/worker/record-vitals/:patientId" element={<ProtectedRoute roles={[UserRole.WORKER]}><WorkerRecordVitalsPage /></ProtectedRoute>} />
            
            {/* Fallback route: Navigate to appropriate dashboard or a message if no user */}
            <Route path="*" element={
                <ProtectedRoute> 
                   {currentUserData?.role === UserRole.STAFF ? <Navigate to="/" replace /> :
                    currentUserData?.role === UserRole.WORKER ? <Navigate to="/worker/dashboard" replace /> :
                     <div className="p-6 text-center">No default route for current user state.</div>
                   }
                </ProtectedRoute>
            }/>
          </Routes>
        </main>
      </div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black opacity-50 md:hidden" onClick={toggleSidebar}></div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppAuthProvider>
      <AppContent />
    </AppAuthProvider>
  );
};

export default App;