
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import Login from './Login'

// ADMIN
import AdminDashboard from './admin/AdminDashboard'
import DashboardHome from './admin/DashboardHome'
import Users from './admin/Users'
import Schemes from './admin/Schemes'
import DepartmentManagement from './admin/DepartmentManagement'
import DoctorManagement from './admin/DoctorManagement'

// Protected Route
import ProtectedRoute from './admin/ProtectedRoute'

// RECEPTION
import ReceptionDashboard from './reception/ReceptionDashboard'
import ReceptionHome from './reception/ReceptionHome'
import PatientManagement from './reception/PatientManagement'
import OpRegistration from './reception/OpRegistration'
import OPTicket from './reception/OPTicket'
import ReceptionToken from './reception/ReceptionToken'


// BILLING
import BillingDashboard from './billing/BillingDashboard'
import BillingHome from './billing/BillingHome'



function App() {

  return (
    <>
    <BrowserRouter>

            <Routes>

                {/* ================================= */}
                {/* LOGIN */}
                {/* ================================= */}

                <Route path="/" element={<Login />}/>


                {/* ================================= */}
                {/* ADMIN */}
                {/* ================================= */}

                <Route element={<ProtectedRoute allowedRoles={["ADMIN"]}/> }>
                    <Route path="/dashboard"element={<AdminDashboard />}>
                        <Route index element={<DashboardHome />} />
                        <Route path="users" element={<Users />}/>
                        <Route path="schemes" element={<Schemes />}/>
                        <Route path="departments" element={<DepartmentManagement />} />
                        <Route path="doctors" element={<DoctorManagement />}/>
                    </Route>
                </Route>


                {/* ================================= */}
                {/* RECEPTION */}
                {/* ================================= */}

                <Route element={<ProtectedRoute allowedRoles={["RECEPTION"]}/>}>
                    <Route path="/reception" element={<ReceptionDashboard />}>
                        <Route index element={<ReceptionHome />}/>
                        <Route path="patients" element={<PatientManagement />}/>
                        <Route path="/reception/op/:patientId" element={<OpRegistration />}/>
                        <Route path="/reception/op-ticket/:visitId" element={<OPTicket />}/>
                        <Route path="/reception/token" element={<ReceptionToken/>}/>
                    </Route>
                </Route>


                {/* ================================= */}
                {/* BILLING */}
                {/* ================================= */}

                <Route
                    element={<ProtectedRoute allowedRoles={["BILLING"]}/>}>
                    <Route path="/billing" element={<BillingDashboard />}>
                        <Route index element={<BillingHome />}/>
                    </Route>
                </Route>

            </Routes>

        </BrowserRouter>
      
    </>
  )
}

export default App
