
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { TargetGroup, VitalSign, User, UserRole, StaffRecommendation } from '../../types';
import * as api from '../../services/appService'; // Use appService
// import { StaffRecommendation } from '../../services/appService'; // This line is removed
import { Button, Card, Input, Textarea, Spinner, ToastAlert, PlusIcon } from '../common/UiElements';
import { useAuth } from '../../App'; // Import useAuth for mock context

// --- Helper Functions ---
const formatDate = (isoString?: string, includeTime: boolean = true): string => {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = false;
  }
  return date.toLocaleDateString('en-CA', options);
};

const calculateAge = (dateOfBirth: string): number => {
    if(!dateOfBirth) return 0;
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    if (isNaN(birthDate.getTime())) return 0;
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};


// --- Worker Dashboard Page ---
export const WorkerDashboardPage: React.FC = () => {
    const { currentUserData } = useAuth(); 
    const [recentVitals, setRecentVitals] = useState<VitalSign[]>([]);
    const [patients, setPatients] = useState<TargetGroup[]>([]); 
    const [recommendations, setRecommendations] = useState<StaffRecommendation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUserData || currentUserData.role !== UserRole.WORKER) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            try {
                const [vitalsData, patientsData, recsData] = await Promise.all([
                    api.getVitalSignsRecordedByWorker(currentUserData.uid, 5), // Use api, currentUserData.uid is doc ID
                    api.getTargetGroups(), // Use api
                    api.getStaffRecommendationsForWorker(currentUserData.uid, 3) // Use api, currentUserData.uid is doc ID
                ]);
                setRecentVitals(vitalsData);
                setPatients(patientsData);
                setRecommendations(recsData);
            } catch (error) {
                console.error("Error fetching worker dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [currentUserData]);

    const getPatientName = (patientId: string): string => {
        return patients.find(p => p.id === patientId)?.name || 'Unknown Patient';
    };
    
    if (isLoading) return <div className="p-4 text-center"><Spinner size="lg" /></div>;
    if (!currentUserData || currentUserData.role !== UserRole.WORKER) {
        return <div className="p-4 text-center text-red-500">Not authorized or user data not loaded.</div>;
    }


    return (
        <div className="p-4 space-y-6 sm:p-6">
            <h1 className="text-2xl font-semibold text-gray-800 sm:text-3xl">
                Welcome, {currentUserData?.fullName || 'Worker'}!
            </h1>

            <Card>
                <Button 
                    variant="primary" 
                    size="lg" 
                    className="w-full py-3" 
                    onClick={() => navigate('/worker/patients')}
                    leftIcon={<PlusIcon className="w-6 h-6" />}
                >
                    Record New Vitals
                </Button>
            </Card>
            
            <Card title="Patients Recently Attended">
                {recentVitals.length > 0 ? (
                    <ul className="space-y-3">
                        {recentVitals.map(vital => (
                            <li key={vital.id} className="p-3 bg-gray-50 rounded-md shadow-sm hover:bg-gray-100">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-blue-600">{getPatientName(vital.patientId)}</span>
                                    <span className="text-xs text-gray-500">{formatDate(vital.recordDate)}</span>
                                </div>
                                <p className="text-sm text-gray-700">
                                    BP: {vital.bloodPressureSys}/{vital.bloodPressureDia}, HR: {vital.heartRate}, Temp: {vital.temperature}°C
                                </p>
                                {vital.isCritical && <p className="text-xs text-red-500 font-semibold">Alert Triggered</p>}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500">No recent vitals recorded by you.</p>
                )}
            </Card>

            <Card title="Recommendations from Staff">
                 {recommendations.length > 0 ? (
                    <ul className="space-y-3">
                        {recommendations.map(rec => (
                            <li key={rec.id} className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-md">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium text-yellow-700">For: {rec.patientName}</span>
                                    <span className="text-xs text-gray-500">{formatDate(rec.date)}</span>
                                </div>
                                <p className="text-sm text-gray-700">{rec.recommendationText}</p>
                                <p className="text-xs text-gray-500 mt-1">From: {rec.staffName}</p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500">No new recommendations or notifications from staff.</p>
                )}
            </Card>
        </div>
    );
};

// --- Worker Patients List Page ---
export const WorkerPatientsListPage: React.FC = () => {
    const [patients, setPatients] = useState<TargetGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchPatients = async () => {
            setIsLoading(true);
            try {
                const data = await api.getTargetGroups(); // Use api
                setPatients(data);
            } catch (error) {
                console.error("Error fetching patients:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchPatients();
    }, []);

    const filteredPatients = useMemo(() => {
        if (!searchTerm) return patients;
        return patients.filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.idCard.includes(searchTerm)
        );
    }, [patients, searchTerm]);

    if (isLoading) return <div className="p-4 text-center"><Spinner size="lg" /></div>;

    return (
        <div className="p-4 space-y-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <h1 className="text-2xl font-semibold text-gray-800">Select Patient</h1>
              <Link to="/worker/dashboard" className="text-sm text-blue-600 hover:underline">&larr; Back to Dashboard</Link>
            </div>
            
            <Input 
                placeholder="Search by name or ID card..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-base py-2.5"
            />

            {filteredPatients.length > 0 ? (
                <ul className="space-y-3">
                    {filteredPatients.map(patient => (
                        <li key={patient.id} className="bg-white shadow rounded-lg p-3 sm:p-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900">{patient.name}</h3>
                                    <p className="text-sm text-gray-600">
                                        ID: {patient.idCard} &bull; Age: {calculateAge(patient.dateOfBirth)} &bull; {patient.gender}
                                    </p>
                                </div>
                                <Button 
                                    variant="primary" 
                                    size="sm" 
                                    className="mt-2 sm:mt-0 w-full sm:w-auto"
                                    onClick={() => navigate(`/worker/record-vitals/${patient.id}`)}
                                >
                                    Record Vitals
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-center text-gray-500 py-8">
                    {searchTerm ? "No patients match your search." : "No patients found."}
                </p>
            )}
        </div>
    );
};

// --- Worker Record Vitals Page (Form) ---
export const WorkerRecordVitalsPage: React.FC = () => {
    const { patientId } = useParams<{ patientId: string }>();
    const navigate = useNavigate();
    const { currentUserData } = useAuth();
    const [patient, setPatient] = useState<TargetGroup | null>(null);
    const [formData, setFormData] = useState<Partial<VitalSign>>({
        bloodPressureSys: undefined, bloodPressureDia: undefined, heartRate: undefined, temperature: undefined,
        symptoms: '', comment: '', photoUrl: ''
    });
    // No selectedFile state needed for mock
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingPatient, setIsLoadingPatient] = useState(true);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'warning' | 'info'} | null>(null);

    useEffect(() => {
        const loadData = async () => {
            if (!patientId) {
                navigate('/worker/patients');
                return;
            }
            setIsLoadingPatient(true);
            try {
                const patientData = await api.getTargetGroupById(patientId); // Use api
                if (!patientData) {
                    setToast({message: 'Patient not found.', type: 'error'});
                    navigate('/worker/patients');
                    return;
                }
                setPatient(patientData);
            } catch (error) {
                console.error("Error fetching patient details:", error);
                setToast({message: 'Failed to load patient data.', type: 'error'});
            } finally {
                setIsLoadingPatient(false);
            }
        };
        loadData();
    }, [patientId, navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ 
            ...prev, 
            [name]: name === 'symptoms' || name === 'comment' || name === 'photoUrl' ? value : (parseFloat(value) || undefined)
        }));
    };
    
    // Mock file handling: photoUrl is just a string
    // const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    //     if (e.target.files && e.target.files[0]) {
    //          // For mock, just store a fake path or name if needed by appService
    //          setFormData(prev => ({...prev, photoUrl: `/uploads/mock/${e.target.files![0].name}`}));
    //         setToast({message: `File "${e.target.files[0].name}" selected (mock).`, type: 'info'});
    //     }
    // };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.bloodPressureSys || !formData.bloodPressureDia || !formData.heartRate || !formData.temperature) {
            setToast({message: 'Please fill all required vital sign fields.', type: 'error'});
            return;
        }
        if (!currentUserData?.uid) {
            setToast({message: 'Cannot record vitals: Worker user not identified.', type: 'error'});
            return;
        }
        if (!patient) {
             setToast({message: 'Cannot record vitals: Patient data not loaded.', type: 'error'});
            return;
        }

        setIsSubmitting(true);
        try {
            const vitalDataToSave: Omit<VitalSign, 'id' | 'isCritical'> = {
                patientId: patient.id,
                bloodPressureSys: formData.bloodPressureSys!,
                bloodPressureDia: formData.bloodPressureDia!,
                heartRate: formData.heartRate!,
                temperature: formData.temperature!,
                symptoms: formData.symptoms || undefined,
                comment: formData.comment || undefined,
                photoUrl: formData.photoUrl || undefined, // Stays as string for mock
                recordedBy: currentUserData.uid, // uid from User type (document ID)
                recordDate: new Date().toISOString(),
            };

            const { alert } = await api.recordVitalSign(vitalDataToSave); // Use api
            setToast({ message: `Vital signs recorded successfully for ${patient?.name}. ${alert ? 'Alert generated!' : ''}`, type: 'success'});
            setFormData({ bloodPressureSys: undefined, bloodPressureDia: undefined, heartRate: undefined, temperature: undefined, symptoms: '', comment: '', photoUrl: '' });
            
            setTimeout(() => navigate('/worker/patients'), 2000); 

        } catch (error) {
            console.error("Error recording vital sign:", error);
            setToast({message: 'Failed to record vital signs.', type: 'error'});
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (isLoadingPatient) return <div className="p-4 text-center"><Spinner size="lg" /></div>;
    if (!patient) return <div className="p-4 text-center text-red-500">Patient data could not be loaded. <Link to="/worker/patients" className="underline">Return to patient list</Link>.</div>;

    return (
        <div className="p-4 sm:p-6">
            {toast && <ToastAlert message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="mb-4 flex justify-between items-center">
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Record Vitals for {patient.name}</h1>
                <Link to="/worker/patients" className="text-sm text-blue-600 hover:underline">&larr; Change Patient</Link>
            </div>

            <Card className="bg-white">
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Systolic BP (mmHg)" name="bloodPressureSys" type="number" value={formData.bloodPressureSys || ''} onChange={handleChange} required className="py-2.5 text-base" />
                        <Input label="Diastolic BP (mmHg)" name="bloodPressureDia" type="number" value={formData.bloodPressureDia || ''} onChange={handleChange} required className="py-2.5 text-base" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Heart Rate (bpm)" name="heartRate" type="number" value={formData.heartRate || ''} onChange={handleChange} required className="py-2.5 text-base" />
                        <Input label="Temperature (°C)" name="temperature" type="number" step="0.1" value={formData.temperature || ''} onChange={handleChange} required className="py-2.5 text-base" />
                    </div>
                    
                    <Textarea label="Symptoms (Optional)" name="symptoms" value={formData.symptoms || ''} onChange={handleChange} rows={3} className="py-2.5 text-base"/>
                    <Textarea label="Comments (Optional)" name="comment" value={formData.comment || ''} onChange={handleChange} rows={3} className="py-2.5 text-base"/>
                    
                    <Input 
                        label="Photo of Symptoms URL (Optional, Mock)" 
                        name="photoUrl"
                        type="text"
                        value={formData.photoUrl || ''}
                        onChange={handleChange}
                        placeholder="e.g. /images/symptom.jpg or https://example.com/image.png"
                        className="py-2.5 text-base"
                    />

                    <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="w-full py-3">
                        {isSubmitting ? <Spinner size="sm"/> : 'Save Vital Signs'}
                    </Button>
                </form>
            </Card>
        </div>
    );
};