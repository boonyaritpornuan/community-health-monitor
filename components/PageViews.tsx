
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, TargetGroup, VitalSign, Alert, UserRole, AlertStatus, VitalThresholds } from '../types';
import * as api from '../services/appService'; // Use appService
import { Button, Card, Modal, Input, Select, Textarea, BasicTable, SimpleBarChart, SimpleLineChart, EditIcon, DeleteIcon, ViewIcon, PlusIcon, Spinner, ToastAlert } from './common/UiElements';
import { USER_ROLES_OPTIONS, ALERT_STATUS_OPTIONS, GENDER_OPTIONS } from '../constants';
import { useParams, useNavigate } from 'react-router-dom';
import { TableColumn } from './common/UiElements'; 
import { useAuth } from '../App'; // Import useAuth for mock context

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
    if (!dateOfBirth) return 0;
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

// --- Dashboard Page ---
export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<{ totalPatients: number; newAlerts: number; criticalVitalsToday: number; avgHeartRate: number } | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [recentVitals, setRecentVitals] = useState<VitalSign[]>([]);
  const [allPatientsData, setAllPatientsData] = useState<TargetGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [statsData, alertsData, patientsData] = await Promise.all([
          api.getDashboardStats(),
          api.getAlerts(AlertStatus.NEW),
          api.getTargetGroups()
        ]);
        setStats(statsData);
        setRecentAlerts(alertsData.slice(0, 5)); 
        setAllPatientsData(patientsData);
        
        let combinedVitals: VitalSign[] = [];
        for (const p of patientsData.slice(0,10)) { 
            const pVitals = await api.getVitalSignsForPatient(p.id);
            combinedVitals = [...combinedVitals, ...pVitals];
        }
        combinedVitals.sort((a,b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime());
        setRecentVitals(combinedVitals.slice(0,5));

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const vitalSignTrendData = useMemo(() => {
    if (!recentVitals || recentVitals.length === 0) return [];
    return recentVitals.map(v => ({
        name: formatDate(v.recordDate, false), 
        Systolic: v.bloodPressureSys,
        Diastolic: v.bloodPressureDia,
        HeartRate: v.heartRate,
    })).reverse(); 
  }, [recentVitals]);

  if (isLoading) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <h1 className="text-3xl font-semibold text-gray-800">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-blue-500 text-white">
          <h4 className="text-lg font-medium">Total Patients</h4>
          <p className="text-4xl font-bold">{stats?.totalPatients ?? 'N/A'}</p>
        </Card>
        <Card className="bg-red-500 text-white">
          <h4 className="text-lg font-medium">New Alerts</h4>
          <p className="text-4xl font-bold">{stats?.newAlerts ?? 'N/A'}</p>
        </Card>
        <Card className="bg-yellow-500 text-white">
          <h4 className="text-lg font-medium">Critical Vitals Today</h4>
          <p className="text-4xl font-bold">{stats?.criticalVitalsToday ?? 'N/A'}</p>
        </Card>
         <Card className="bg-green-500 text-white">
          <h4 className="text-lg font-medium">Avg. Heart Rate</h4>
          <p className="text-4xl font-bold">{stats?.avgHeartRate ?? 'N/A'} bpm</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Recent Critical Alerts">
          {recentAlerts.length > 0 ? (
            <ul className="space-y-3">
              {recentAlerts.map(alert => (
                <li key={alert.id} className="p-3 bg-red-50 hover:bg-red-100 rounded-md shadow-sm cursor-pointer" onClick={() => navigate(`/alerts?alertId=${alert.id}`)}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-red-700">{alert.patientName}</span>
                    <span className="text-xs text-gray-500">{formatDate(alert.createdAt)}</span>
                  </div>
                  <p className="text-sm text-red-600 truncate">{alert.message}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-gray-500">No new critical alerts.</p>}
           {recentAlerts.length > 0 && (
            <Button variant="primary" size="sm" className="mt-4" onClick={() => navigate('/alerts')}>View All Alerts</Button>
          )}
        </Card>

        <Card title="Recent Vital Signs Overview">
           <SimpleLineChart 
                data={vitalSignTrendData}
                xAxisKey="name"
                lineKeys={[
                    { key: 'Systolic', color: '#8884d8'},
                    { key: 'Diastolic', color: '#82ca9d'},
                    { key: 'HeartRate', color: '#ffc658'},
                ]}
            />
        </Card>
      </div>
        <Card title="Recently Recorded Vitals">
          {recentVitals.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">BP (Sys/Dia)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">HR</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Temp</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentVitals.map(vital => {
                    const patient = allPatientsData.find(p => p.id === vital.patientId);
                    return (
                    <tr key={vital.id} className={`hover:bg-gray-50 ${vital.isCritical ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{patient?.name || vital.patientId}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{vital.bloodPressureSys}/{vital.bloodPressureDia}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{vital.heartRate}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{vital.temperature}°C</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{formatDate(vital.recordDate)}</td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          ) : <p className="text-gray-500">No recent vitals recorded.</p>}
        </Card>
    </div>
  );
};

// --- Patient Related Components ---
const PatientForm: React.FC<{ initialData?: TargetGroup; onSubmit: (data: Omit<TargetGroup, 'id' | 'createdAt'>) => void; onCancel: () => void; }> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<Partial<TargetGroup>>(
    initialData || { name: '', idCard: '', address: '', dateOfBirth: '', gender: 'Other', emergencyContacts: [] }
  );
  const [ecName, setEcName] = useState('');
  const [ecPhone, setEcPhone] = useState('');
  const [ecRelationship, setEcRelationship] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddEmergencyContact = () => {
    if (ecName && ecPhone && ecRelationship) {
        const newContact = { id: `temp-${Date.now()}`, name: ecName, phone: ecPhone, relationship: ecRelationship };
        setFormData(prev => ({...prev, emergencyContacts: [...(prev.emergencyContacts || []), newContact]}));
        setEcName(''); setEcPhone(''); setEcRelationship('');
    }
  };

  const handleRemoveEmergencyContact = (id: string) => {
    setFormData(prev => ({...prev, emergencyContacts: (prev.emergencyContacts || []).filter(ec => ec.id !== id)}));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.idCard || !formData.dateOfBirth || !formData.gender) {
        window.alert("Please fill all required fields: Name, ID Card, Date of Birth, Gender.");
        return;
    }
    const { id, createdAt, ...dataToSubmit } = formData; // Exclude id and createdAt for submission
    onSubmit(dataToSubmit as Omit<TargetGroup, 'id' | 'createdAt'>);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input name="name" label="Full Name" value={formData.name || ''} onChange={handleChange} required />
      <Input name="idCard" label="ID Card Number" value={formData.idCard || ''} onChange={handleChange} required />
      <Input name="address" label="Address" value={formData.address || ''} onChange={handleChange} />
      <Input name="dateOfBirth" label="Date of Birth" type="date" value={formData.dateOfBirth || ''} onChange={handleChange} required />
      <Select name="gender" label="Gender" value={formData.gender || 'Other'} onChange={handleChange} options={GENDER_OPTIONS} required/>
      <Input name="photoUrl" label="Photo URL (Optional)" value={formData.photoUrl || ''} onChange={handleChange} placeholder="e.g. https://example.com/photo.jpg"/>
      
      <div className="border-t pt-4 mt-4">
        <h3 className="text-md font-semibold mb-2">Emergency Contacts</h3>
        {(formData.emergencyContacts || []).map((ec) => (
            <div key={ec.id} className="flex items-center justify-between p-2 mb-1 bg-gray-100 rounded">
                <div>{ec.name} ({ec.relationship}) - {ec.phone}</div>
                <Button type="button" variant="danger" size="sm" onClick={() => handleRemoveEmergencyContact(ec.id)}>Remove</Button>
            </div>
        ))}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
            <Input name="ecName" placeholder="Contact Name" value={ecName} onChange={e => setEcName(e.target.value)} containerClassName="mb-0" />
            <Input name="ecPhone" placeholder="Contact Phone" value={ecPhone} onChange={e => setEcPhone(e.target.value)} containerClassName="mb-0" />
            <Input name="ecRelationship" placeholder="Relationship" value={ecRelationship} onChange={e => setEcRelationship(e.target.value)} containerClassName="mb-0" />
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={handleAddEmergencyContact} className="mt-2">Add Contact</Button>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">{initialData ? 'Update' : 'Create'} Patient</Button>
      </div>
    </form>
  );
};

const VitalSignForm: React.FC<{ patientId: string; patientName: string; onSubmitSuccess: () => void }> = ({ patientId, patientName, onSubmitSuccess }) => {
    const [formData, setFormData] = useState<Partial<VitalSign>>({
        bloodPressureSys: undefined, bloodPressureDia: undefined, heartRate: undefined, temperature: undefined,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info' | 'warning'} | null>(null);
    const { currentUserData } = useAuth();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'symptoms' || name === 'comment' || name === 'photoUrl' ? value : parseFloat(value) || undefined }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.bloodPressureSys || !formData.bloodPressureDia || !formData.heartRate || !formData.temperature) {
            setToast({message: 'Please fill all vital sign fields.', type: 'error'});
            return;
        }
        if (!currentUserData?.uid) {
            setToast({message: 'User not identified. Cannot record vitals.', type: 'error'});
            return;
        }
        setIsSubmitting(true);
        try {
            const vitalDataToSave: Omit<VitalSign, 'id' | 'isCritical'> = {
                patientId,
                bloodPressureSys: formData.bloodPressureSys!,
                bloodPressureDia: formData.bloodPressureDia!,
                heartRate: formData.heartRate!,
                temperature: formData.temperature!,
                symptoms: formData.symptoms || undefined,
                comment: formData.comment || undefined,
                photoUrl: formData.photoUrl || undefined, 
                recordedBy: currentUserData.uid, // uid from User type is the document ID for user
                recordDate: new Date().toISOString(),
            };

            const { alert } = await api.recordVitalSign(vitalDataToSave);
            setToast({ message: `Vital signs recorded. ${alert ? 'Alert generated!' : ''}`, type: 'success'});
            setFormData({ bloodPressureSys: undefined, bloodPressureDia: undefined, heartRate: undefined, temperature: undefined, symptoms: '', comment: '', photoUrl: '' });
            onSubmitSuccess(); 
        } catch (error) {
            console.error("Error recording vital sign:", error);
            setToast({message: 'Failed to record vital signs.', type: 'error'});
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <Card title="Record New Vital Signs">
            {toast && <ToastAlert message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input name="bloodPressureSys" type="number" label="Systolic BP (mmHg)" value={formData.bloodPressureSys || ''} onChange={handleChange} required />
                    <Input name="bloodPressureDia" type="number" label="Diastolic BP (mmHg)" value={formData.bloodPressureDia || ''} onChange={handleChange} required />
                    <Input name="heartRate" type="number" label="Heart Rate (bpm)" value={formData.heartRate || ''} onChange={handleChange} required />
                    <Input name="temperature" type="number" step="0.1" label="Temperature (°C)" value={formData.temperature || ''} onChange={handleChange} required />
                </div>
                <Textarea name="symptoms" label="Symptoms (Optional)" value={formData.symptoms || ''} onChange={handleChange} />
                <Textarea name="comment" label="Comments (Optional)" value={formData.comment || ''} onChange={handleChange} />
                <Input name="photoUrl" label="Symptom Photo URL (Mock)" value={formData.photoUrl || ''} onChange={handleChange} placeholder="e.g. /uploads/symptom.jpg"/>
                <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? <Spinner size="sm"/> : 'Record Vitals'}
                </Button>
            </form>
        </Card>
    );
};


const PatientDetailPage: React.FC = () => {
    const { patientId } = useParams<{ patientId: string }>();
    const navigate = useNavigate();
    const [patient, setPatient] = useState<TargetGroup | null>(null);
    const [vitals, setVitals] = useState<VitalSign[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showRecordVitals, setShowRecordVitals] = useState(false);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info' | 'warning'} | null>(null);
    const [workerNames, setWorkerNames] = useState<Record<string, string>>({});


    const fetchPatientData = useCallback(async () => {
        if (!patientId) return;
        setIsLoading(true);
        try {
            const [patientData, vitalsData] = await Promise.all([
                api.getTargetGroupById(patientId),
                api.getVitalSignsForPatient(patientId)
            ]);
            setPatient(patientData || null);
            setVitals(vitalsData);

            const workerIds = new Set(vitalsData.map(v => v.recordedBy));
            const names: Record<string, string> = {};
            for (const id of workerIds) {
                if (!workerNames[id]) { 
                    const worker = await api.getUserById(id); // getUserById expects document ID (user.uid)
                    if (worker) names[id] = worker.fullName;
                }
            }
            setWorkerNames(prev => ({...prev, ...names}));

        } catch (error) {
            console.error("Error fetching patient details:", error);
            setToast({message: 'Failed to load patient data.', type: 'error'});
        } finally {
            setIsLoading(false);
        }
    }, [patientId, workerNames]); 

    useEffect(() => {
        fetchPatientData();
    }, [fetchPatientData]);

    const handleUpdatePatient = async (dataToSubmit: Omit<TargetGroup, 'id' | 'createdAt'>) => {
        if (!patient) return;
        try {
            await api.updateTargetGroup(patient.id, dataToSubmit);
            setToast({message: 'Patient details updated successfully.', type: 'success'});
            setShowEditModal(false);
            fetchPatientData(); 
        } catch (error) {
            console.error("Error updating patient:", error);
            setToast({message: 'Failed to update patient.', type: 'error'});
        }
    };
    
    const vitalSignsChartData = useMemo(() => {
        return vitals.map(v => ({
            date: formatDate(v.recordDate, false),
            Systolic: v.bloodPressureSys,
            Diastolic: v.bloodPressureDia,
            HeartRate: v.heartRate,
            Temperature: v.temperature,
        })).reverse(); 
    }, [vitals]);

    if (isLoading) return <div className="p-6"><Spinner /></div>;
    if (!patient) return <div className="p-6 text-red-500">Patient not found. <Button onClick={() => navigate('/patients')}>Go to Patients List</Button></div>;

    return (
        <div className="p-4 sm:p-6 space-y-6">
            {toast && <ToastAlert message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-semibold text-gray-800">{patient.name}</h1>
                <div className="space-x-2">
                    <Button onClick={() => setShowEditModal(true)} variant="secondary" leftIcon={<EditIcon className="w-4 h-4"/>}>Edit Patient</Button>
                    <Button onClick={() => navigate('/patients')} variant="secondary">Back to List</Button>
                </div>
            </div>

            <Card>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <img src={patient.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(patient.name)}&size=200&background=random`} alt={patient.name} className="w-32 h-32 rounded-full mx-auto md:mx-0 object-cover shadow-md" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                        <p><strong>ID Card:</strong> {patient.idCard}</p>
                        <p><strong>Date of Birth:</strong> {formatDate(patient.dateOfBirth, false)} (Age: {calculateAge(patient.dateOfBirth)})</p>
                        <p><strong>Gender:</strong> {patient.gender}</p>
                        <p><strong>Address:</strong> {patient.address}</p>
                        <p><strong>Registered:</strong> {formatDate(patient.createdAt)}</p>
                    </div>
                </div>
                 {patient.emergencyContacts && patient.emergencyContacts.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                        <h4 className="text-md font-semibold mb-2">Emergency Contacts:</h4>
                        <ul className="list-disc list-inside space-y-1">
                            {patient.emergencyContacts.map(ec => (
                                <li key={ec.id}>{ec.name} ({ec.relationship}): {ec.phone}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </Card>

            <Button onClick={() => setShowRecordVitals(!showRecordVitals)} variant="primary" leftIcon={<PlusIcon className="w-5 h-5"/>}>
                {showRecordVitals ? 'Hide Form' : 'Record New Vitals'}
            </Button>
            {showRecordVitals && patientId && <VitalSignForm patientId={patientId} patientName={patient.name} onSubmitSuccess={fetchPatientData} />}
            
            <Card title="Vital Signs History">
                 <SimpleLineChart 
                    data={vitalSignsChartData}
                    xAxisKey="date"
                    lineKeys={[
                        { key: 'Systolic', color: '#8884d8'},
                        { key: 'Diastolic', color: '#82ca9d'},
                    ]}
                    title="Blood Pressure Trend"
                />
                 <SimpleLineChart 
                    className="mt-6"
                    data={vitalSignsChartData}
                    xAxisKey="date"
                    lineKeys={[
                        { key: 'HeartRate', color: '#ffc658'},
                        { key: 'Temperature', color: '#ff7300'},
                    ]}
                    title="Heart Rate & Temperature Trend"
                />
            </Card>

            <Card title="All Recorded Vitals">
                 <BasicTable<VitalSign>
                    columns={[
                        { header: 'Date', accessor: (item: VitalSign) => formatDate(item.recordDate) },
                        { header: 'BP (Sys/Dia)', accessor: (item: VitalSign) => `${item.bloodPressureSys}/${item.bloodPressureDia}`, cellClassName: (item: VitalSign) => item.isCritical ? 'text-red-600 font-semibold' : ''},
                        { header: 'Heart Rate', accessor: 'heartRate', cellClassName: (item: VitalSign) => item.isCritical ? 'text-red-600 font-semibold' : ''},
                        { header: 'Temp (°C)', accessor: 'temperature', cellClassName: (item: VitalSign) => item.isCritical ? 'text-red-600 font-semibold' : '' },
                        { header: 'Symptoms', accessor: 'symptoms' },
                        { header: 'Recorded By', accessor: (item: VitalSign) => workerNames[item.recordedBy] || item.recordedBy },
                    ]}
                    data={vitals}
                    isLoading={isLoading}
                 />
            </Card>

            {showEditModal && patient && (
                <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Patient Details">
                    <PatientForm initialData={patient} onSubmit={handleUpdatePatient} onCancel={() => setShowEditModal(false)} />
                </Modal>
            )}
        </div>
    );
};

// --- Patients List Page ---
export const PatientsListPage: React.FC = () => {
  const [patients, setPatients] = useState<TargetGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info' | 'warning'} | null>(null);
  const navigate = useNavigate();
  const { currentUserData } = useAuth();

  const fetchPatients = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getTargetGroups();
      setPatients(data);
    } catch (error) {
      console.error("Error fetching patients:", error);
      setToast({message: 'Failed to load patients.', type: 'error'});
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const handleCreatePatient = async (patientData: Omit<TargetGroup, 'id' | 'createdAt'>) => {
    if (!currentUserData?.uid) {
        setToast({message: 'Cannot create patient: User not identified.', type: 'error'});
        return;
    }
    try {
      await api.createTargetGroup({ ...patientData, createdBy: currentUserData.uid }); // uid from User type
      setToast({message: 'Patient created successfully.', type: 'success'});
      setShowCreateModal(false);
      fetchPatients(); 
    } catch (error) {
      console.error("Error creating patient:", error);
      setToast({message: 'Failed to create patient.', type: 'error'});
    }
  };

  const handleDeletePatient = async (patientId: string) => {
    if (window.confirm("Are you sure you want to delete this patient and all their data? This action cannot be undone.")) {
      try {
        await api.deleteTargetGroup(patientId);
        setToast({message: 'Patient deleted successfully.', type: 'success'});
        fetchPatients(); 
      } catch (error) {
        console.error("Error deleting patient:", error);
        setToast({message: 'Failed to delete patient.', type: 'error'});
      }
    }
  };
  
  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.idCard.includes(searchTerm)
  );

  const columns: TableColumn<TargetGroup>[] = [ 
    { header: 'Name', accessor: 'name' },
    { header: 'ID Card', accessor: 'idCard' },
    { header: 'Age', accessor: (item: TargetGroup) => calculateAge(item.dateOfBirth) },
    { header: 'Gender', accessor: 'gender' },
    { header: 'Registered On', accessor: (item: TargetGroup) => formatDate(item.createdAt, false) },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {toast && <ToastAlert message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-semibold text-gray-800">Patient Management</h1>
        <Button onClick={() => setShowCreateModal(true)} variant="primary" leftIcon={<PlusIcon className="w-5 h-5"/>}>Add Patient</Button>
      </div>
      
      <Input 
        placeholder="Search by name or ID card..." 
        value={searchTerm} 
        onChange={(e) => setSearchTerm(e.target.value)}
        containerClassName="max-w-md"
      />

      <Card>
        <BasicTable<TargetGroup>
            columns={columns}
            data={filteredPatients}
            isLoading={isLoading}
            onRowClick={(patient) => navigate(`/patients/${patient.id}`)}
            renderRowActions={(patient: TargetGroup) => (
                <>
                    <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/patients/${patient.id}`); }} leftIcon={<ViewIcon className="w-4 h-4" />}>View</Button>
                    <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); handleDeletePatient(patient.id); }} leftIcon={<DeleteIcon className="w-4 h-4" />}>Delete</Button>
                </>
            )}
        />
      </Card>

      {showCreateModal && (
        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add New Patient">
          <PatientForm onSubmit={handleCreatePatient} onCancel={() => setShowCreateModal(false)} />
        </Modal>
      )}
    </div>
  );
};


// --- Alerts Page ---
interface ProcessedByCellProps { staffId?: string; }
const ProcessedByCell: React.FC<ProcessedByCellProps> = ({ staffId }) => {
  const [staffName, setStaffName] = useState('N/A');
  useEffect(() => {
    if (staffId) {
      setStaffName('Loading...');
      api.getUserById(staffId) // staffId is User.uid (document ID)
        .then(user => setStaffName(user?.fullName || 'Unknown Staff'))
        .catch(() => setStaffName('Error'));
    } else {
      setStaffName('N/A');
    }
  }, [staffId]);
  return <>{staffName}</>;
};

const AlertDiagnosisModal: React.FC<{ alert: Alert; onClose: () => void; onProcess: (diagnosis: string, recommendation: string) => void }> = 
({ alert, onClose, onProcess }) => {
    const [diagnosis, setDiagnosis] = useState(alert.diagnosis || '');
    const [recommendation, setRecommendation] = useState(alert.recommendation || '');

    const handleSubmit = () => {
        if (!diagnosis.trim() || !recommendation.trim()) {
            window.alert("Please provide both diagnosis and recommendation.");
            return;
        }
        onProcess(diagnosis, recommendation);
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={`Process Alert for ${alert.patientName}`} size="lg">
            <div className="space-y-4">
                <div>
                    <h4 className="font-semibold">Alert Details:</h4>
                    <p className="text-sm text-gray-600">{alert.message}</p>
                    <p className="text-xs text-gray-500">Recorded: {formatDate(alert.createdAt)}</p>
                </div>
                <Textarea label="Diagnosis" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} rows={3} required disabled={alert.status === AlertStatus.PROCESSED} />
                <Textarea label="Recommendation / Action Taken" value={recommendation} onChange={e => setRecommendation(e.target.value)} rows={3} required disabled={alert.status === AlertStatus.PROCESSED}/>
            </div>
            <div className="mt-6 flex justify-end space-x-2">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                {alert.status !== AlertStatus.PROCESSED && (
                    <Button variant="primary" onClick={handleSubmit}>Mark as Processed</Button>
                )}
            </div>
        </Modal>
    );
};

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<AlertStatus | ''>('');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info' | 'warning'} | null>(null);
  const navigate = useNavigate();
  const { currentUserData } = useAuth();
  const params = new URLSearchParams(window.location.hash.split('?')[1]); 
  const alertIdFromUrl = params.get('alertId');

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getAlerts(filterStatus || undefined); // Use api (appService)
      setAlerts(data);
      if (alertIdFromUrl && !selectedAlert) { 
          const alertToSelect = data.find(a => a.id === alertIdFromUrl);
          if (alertToSelect) setSelectedAlert(alertToSelect);
      }
    } catch (error) {
      console.error("Error fetching alerts:", error);
      setToast({message: 'Failed to load alerts.', type: 'error'});
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, alertIdFromUrl, selectedAlert]); 

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);
  
  const handleProcessAlert = async (diagnosis: string, recommendation: string) => {
      if (!selectedAlert || !currentUserData?.uid) {
          setToast({message: 'Cannot process alert: Missing data or user not identified.', type: 'error'});
          return;
      }
      try {
          await api.processAlert(selectedAlert.id, diagnosis, recommendation, currentUserData.uid); // Use api
          setToast({message: 'Alert processed successfully.', type: 'success'});
          setSelectedAlert(null);
          navigate("/alerts", { replace: true }); 
          fetchAlerts(); 
      } catch (error) {
          console.error("Error processing alert:", error);
          setToast({message: 'Failed to process alert.', type: 'error'});
      }
  };

  const alertColumns: TableColumn<Alert>[] = [
    { header: 'Patient', accessor: 'patientName', cellClassName: (item: Alert) => item.status === AlertStatus.NEW ? 'font-bold text-red-600' : '' },
    { header: 'Message', accessor: 'message', cellClassName: 'truncate max-w-xs' },
    { header: 'Status', accessor: (item: Alert) => (
        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${item.status === AlertStatus.NEW ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {item.status}
        </span>
    )},
    { header: 'Created At', accessor: (item: Alert) => formatDate(item.createdAt) },
    { header: 'Processed By', accessor: (item: Alert) => <ProcessedByCell staffId={item.staffId} /> }, // staffId is User.uid
    { header: 'Processed At', accessor: (item: Alert) => item.processedAt ? formatDate(item.processedAt) : 'N/A' }
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {toast && <ToastAlert message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-semibold text-gray-800">Alerts</h1>
        <Select
            options={[{value: '', label: 'All Statuses'}, ...ALERT_STATUS_OPTIONS]}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as AlertStatus | '')}
            containerClassName="mb-0 w-48"
        />
      </div>
      <Card>
          <BasicTable<Alert>
            columns={alertColumns}
            data={alerts}
            isLoading={isLoading}
            renderRowActions={(alertItem: Alert) => ( 
                <Button variant={alertItem.status === AlertStatus.NEW ? "warning" : "secondary"} size="sm" onClick={() => setSelectedAlert(alertItem)}>
                    {alertItem.status === AlertStatus.NEW ? "Process" : "View"}
                </Button>
            )}
            onRowClick={(alertItem: Alert) => navigate(`/patients/${alertItem.patientId}`)}
          />
      </Card>
      {selectedAlert && (
          <AlertDiagnosisModal 
            alert={selectedAlert} 
            onClose={() => {
                setSelectedAlert(null);
                if(alertIdFromUrl) navigate("/alerts", { replace: true });
            }} 
            onProcess={handleProcessAlert}
          />
      )}
    </div>
  );
};

// UserForTable uses User.id which is now directly available on User type.
// No need for a separate UserForTable interface if User already has 'id'.
// However, BasicTable expects T extends { id: string | number }. User.id is string.

const UserForm: React.FC<{ initialData?: User; onSubmit: (data: Omit<User, 'id' | 'uid' | 'createdAt'>, password?: string) => void; onCancel: () => void; isEdit: boolean }> = 
({ initialData, onSubmit, onCancel, isEdit }) => {
  const [formData, setFormData] = useState<Partial<User>>(
    initialData || { username: '', email: '', fullName: '', phone: '', role: UserRole.WORKER }
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
     if (!formData.email || !formData.fullName || !formData.phone || !formData.role) {
        window.alert("Please fill all required fields: Email, Full Name, Phone, Role.");
        return;
    }
    if (!isEdit && !password) { 
        window.alert("Password is required for new users.");
        return;
    }
    if (password && password !== confirmPassword) {
        window.alert("Passwords do not match.");
        return;
    }
    // Exclude id, uid, and other managed fields like createdAt from dataToSubmit
    const { id, uid, createdAt, ...dataToSubmit } = formData; 
    onSubmit(dataToSubmit as Omit<User, 'id' | 'uid' | 'createdAt'>, password || undefined);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input name="email" label="Email" type="email" value={formData.email || ''} onChange={handleChange} required />
      <Input name="username" label="Username (Optional)" value={formData.username || ''} onChange={handleChange} />
      <Input name="fullName" label="Full Name" value={formData.fullName || ''} onChange={handleChange} required />
      <Input name="phone" label="Phone Number" value={formData.phone || ''} onChange={handleChange} required />
      <Select name="role" label="Role" value={formData.role || UserRole.WORKER} onChange={handleChange} options={USER_ROLES_OPTIONS} required />
      {formData.role === UserRole.WORKER && (
          <Input name="areaCode" label="Worker Zone (Optional)" value={formData.areaCode || ''} onChange={handleChange} />
      )}
      <Input name="password" type="password" label={isEdit ? "New Password (Optional)" : "Password"} value={password} onChange={(e) => setPassword(e.target.value)} required={!isEdit} />
      {password && <Input name="confirmPassword" type="password" label="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required={!isEdit} />}

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">{isEdit ? 'Update' : 'Create'} User</Button>
      </div>
    </form>
  );
};

export const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]); // User type now has 'id'
  const [isLoading, setIsLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info' | 'warning'} | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getUsers(); 
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
      setToast({message: 'Failed to load users.', type: 'error'});
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleFormSubmit = async (userData: Omit<User, 'id' | 'uid' | 'createdAt'>, newPassword?: string) => {
    // For mock service, password is not really used for auth, but might be on User object
    // The userData here already excludes id, uid, createdAt.
    // Pass newPassword to service if it exists (for auth systems that handle it)
    const dataToApi = { ...userData }; // If newPassword needs to be part of User object for API
                                       // it would be ` { ...userData, ...(newPassword && { passwordField: newPassword }) }`
                                       // but our User type has no password field.
                                       // Firebase Auth typically handles password changes separately.
                                       // For this mock, we'll assume the service handles the conceptual password.

    try {
      if (editingUser) { 
        // Pass only updatable fields from User type.
        // For this example, 'updates' in api.updateUser is Partial<User>.
        // dataToApi (which is Omit<User, 'id'|'uid'|'createdAt'>) fits Partial<User>.
        await api.updateUser(editingUser.uid, dataToApi); // Use editingUser.uid (doc ID)
        setToast({message: 'User updated successfully.', type: 'success'});
      } else { 
        await api.createUser(dataToApi); // createUser expects Omit<User, 'id' | 'uid' | 'createdAt'>
        setToast({message: 'User created successfully.', type: 'success'});
      }
      setShowUserModal(false);
      setEditingUser(undefined);
      fetchUsers();
    } catch (error) {
      console.error("Error saving user:", error);
      setToast({message: `Failed to ${editingUser ? 'update' : 'create'} user.`, type: 'error'});
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowUserModal(true);
  };

  const handleDeleteUser = async (userId: string) => { // userId is User.id (which is User.uid)
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        await api.deleteUser(userId); 
        setToast({message: 'User deleted successfully.', type: 'success'});
        fetchUsers();
      } catch (error) {
        console.error("Error deleting user:", error);
        setToast({message: 'Failed to delete user.', type: 'error'});
      }
    }
  };
  
  const userColumns: TableColumn<User>[] = [ // BasicTable uses User type directly
      { header: 'Full Name', accessor: 'fullName' },
      { header: 'Email', accessor: 'email' },
      { header: 'Role', accessor: 'role' },
      { header: 'Phone', accessor: 'phone' },
      { header: 'Worker Zone', accessor: 'areaCode' },
  ];
  
  // const usersForTable: UserForTable[] = users.map(user => ({ ...user, id: user.uid }));
  // This mapping is no longer strictly needed if User type has 'id' and it's correctly populated.
  // Users from api.getUsers() are now User[] and each User has an 'id'.

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {toast && <ToastAlert message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-semibold text-gray-800">User Management</h1>
        <Button onClick={() => { setEditingUser(undefined); setShowUserModal(true); }} variant="primary" leftIcon={<PlusIcon className="w-5 h-5"/>}>Add User</Button>
      </div>
      <Card>
          <BasicTable<User> 
            columns={userColumns}
            data={users} // users is User[] and User has 'id'
            isLoading={isLoading}
            renderRowActions={(userItem: User) => ( 
                <>
                    <Button variant="secondary" size="sm" onClick={() => handleEditUser(userItem)} leftIcon={<EditIcon className="w-4 h-4"/>}>Edit</Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteUser(userItem.id)} leftIcon={<DeleteIcon className="w-4 h-4"/>}>Delete</Button>
                </>
            )}
          />
      </Card>
      {showUserModal && (
        <Modal isOpen={showUserModal} onClose={() => { setShowUserModal(false); setEditingUser(undefined); }} title={editingUser ? "Edit User" : "Add User"}>
          <UserForm initialData={editingUser} onSubmit={handleFormSubmit} onCancel={() => { setShowUserModal(false); setEditingUser(undefined); }} isEdit={!!editingUser} />
        </Modal>
      )}
    </div>
  );
};

// --- Settings Page ---
export const SettingsPage: React.FC = () => {
  const [thresholds, setThresholds] = useState<VitalThresholds | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info' | 'warning'} | null>(null);
  const { currentUserData } = useAuth();

  useEffect(() => {
    const fetchThresholds = async () => {
      setIsLoading(true);
      try {
        const data = await api.getVitalThresholds(); // Use api
        setThresholds(data);
      } catch (error) {
        console.error("Error fetching thresholds:", error);
        setToast({message: 'Failed to load thresholds.', type: 'error'});
      } finally {
        setIsLoading(false);
      }
    };
    fetchThresholds();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (thresholds) {
      setThresholds({ ...thresholds, [e.target.name]: parseFloat(e.target.value) });
    }
  };

  const handleSaveThresholds = async () => {
    if (!thresholds) return;
    setIsLoading(true);
    try {
      await api.updateVitalThresholds(thresholds); // Use api
      setToast({message: 'Thresholds updated successfully.', type: 'success'});
    } catch (error) {
      console.error("Error updating thresholds:", error);
      setToast({message: 'Failed to update thresholds.', type: 'error'});
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleExport = async (type: 'pdf' | 'excel', dataType: 'patients' | 'alerts') => {
    setToast({message: `Generating ${dataType} ${type} report...`, type: 'info'});
    try {
        let dataToExport; // This should be typed based on what exportReport expects, or pass raw data
        if (dataType === 'patients') {
            dataToExport = await api.getTargetGroups(); 
        } else {
            dataToExport = await api.getAlerts(); 
        }
        // The exportReport in appService takes (type, data), not (type, dataType).
        // The second argument to api.exportReport should be the actual data, not the string 'patients' or 'alerts'.
        const blob = await api.exportReport(type, dataType); // Pass dataType string as per current api.exportReport
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dataType}_report.${type === 'pdf' ? 'pdf' : 'csv'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setToast({message: `${dataType} ${type} report generated.`, type: 'success'});
    } catch (err) {
        console.error(`Error exporting ${dataType} ${type}:`, err);
        setToast({message: `Failed to generate ${dataType} ${type} report.`, type: 'error'});
    }
  }

  if (isLoading && !thresholds && !toast ) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {toast && <ToastAlert message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <h1 className="text-3xl font-semibold text-gray-800">Settings</h1>
      
      <Card title="My Profile">
        {currentUserData ? (
          <div className="space-y-2">
            <p><strong>Name:</strong> {currentUserData.fullName}</p>
            <p><strong>Email:</strong> {currentUserData.email || currentUserData.username}</p>
            <p><strong>Role:</strong> {currentUserData.role}</p>
            <p><strong>Phone:</strong> {currentUserData.phone}</p>
            {currentUserData.role === UserRole.WORKER && <p><strong>Area Code:</strong> {currentUserData.areaCode || 'N/A'}</p>}
          </div>
        ) : <p>Loading profile...</p>}
      </Card>

      {thresholds && (
        <Card title="Vital Sign Thresholds for Alerts">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Configure the thresholds that trigger an alert when new vital signs are recorded.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <Input label="Max Systolic BP" name="maxSystolic" type="number" value={thresholds.maxSystolic} onChange={handleChange} />
              <Input label="Min Systolic BP" name="minSystolic" type="number" value={thresholds.minSystolic} onChange={handleChange} />
              <Input label="Max Diastolic BP" name="maxDiastolic" type="number" value={thresholds.maxDiastolic} onChange={handleChange} />
              <Input label="Min Diastolic BP" name="minDiastolic" type="number" value={thresholds.minDiastolic} onChange={handleChange} />
              <Input label="Max Heart Rate" name="maxHeartRate" type="number" value={thresholds.maxHeartRate} onChange={handleChange} />
              <Input label="Min Heart Rate" name="minHeartRate" type="number" value={thresholds.minHeartRate} onChange={handleChange} />
              <Input label="Max Temperature (°C)" name="maxTemperature" type="number" step="0.1" value={thresholds.maxTemperature} onChange={handleChange} />
              <Input label="Min Temperature (°C)" name="minTemperature" type="number" step="0.1" value={thresholds.minTemperature} onChange={handleChange} />
            </div>
            <Button onClick={handleSaveThresholds} variant="primary" disabled={isLoading && !toast}>
              {isLoading && !toast && !thresholds ? <Spinner size="sm"/> : 'Save Thresholds'}
            </Button>
          </div>
        </Card>
      )}
       <Card title="Export Data" className="mt-6">
        <p className="text-sm text-gray-600 mb-4">Generate reports for patients or alerts.</p>
        <div className="flex flex-wrap gap-2">
            <Button onClick={() => handleExport('pdf', 'patients')}>Export Patients (PDF)</Button>
            <Button onClick={() => handleExport('excel', 'patients')}>Export Patients (CSV)</Button>
            <Button onClick={() => handleExport('pdf', 'alerts')}>Export Alerts (PDF)</Button>
            <Button onClick={() => handleExport('excel', 'alerts')}>Export Alerts (CSV)</Button>
        </div>
      </Card>
    </div>
  );
};

export { PatientsListPage as PatientsPage, PatientDetailPage };