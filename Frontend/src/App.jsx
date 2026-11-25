
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import Login from './Login'

// ADMIN
import AdminDashboard from './admin/AdminDashboard'
import DashboardHome from './admin/DashboardHome'
import Users from './admin/Users'
import Schemes from './admin/Schemes'
import DepartmentManagement from './admin/DepartmentManagement'
import AdminReports from './admin/AdminReports'
import BillingServices from './admin/BillingServices'

// Protected Route
import ProtectedRoute from './admin/ProtectedRoute'

// RECEPTION
import ReceptionDashboard from './reception/ReceptionDashboard'
import ReceptionHome from './reception/ReceptionHome'
import NewPatientRegistration from './reception/NewPatientRegistration'
import RegisteredPatients from './reception/RegisteredPatients'
import RegisteredPatientDetails from './reception/RegisteredPatientDetails'
import OpRegistration from './reception/OPRegistration'
import OPTicket from './reception/OPTicket'
import ReceptionistReports from './reception/ReceptionistReports'


// BILLING
import BillingDashboard from './billing/BillingDashboard'
import BillingHome from './billing/BillingHome'
import NewBill from './billing/NewBill'
import BillReceipt from './billing/BillReceipt'
import BillingReports from './billing/BillingReports'



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
                        <Route path="reports" element={<AdminReports />} />
                        <Route path="billing-services" element={<BillingServices />} />
                        <Route path="billing-reports" element={<BillingReports />} />
                        <Route path="billing-reports/receipt/:billNumber" element={<BillReceipt />} />
                    </Route>
                </Route>


                {/* ================================= */}
                {/* RECEPTION */}
                {/* ================================= */}

                <Route element={<ProtectedRoute allowedRoles={["RECEPTION"]}/>}>
                    <Route path="/reception" element={<ReceptionDashboard />}>
                        <Route index element={<ReceptionHome />}/>
                        <Route path="patients/new" element={<NewPatientRegistration />}/>
                        <Route path="registered-patients" element={<RegisteredPatients />}/>
                        <Route path="registered-patients/details/:patientId" element={<RegisteredPatientDetails />}/>
                        <Route path="/reception/op/:patientId" element={<OpRegistration />}/>
                        <Route path="/reception/op-ticket/:visitId" element={<OPTicket />}/>
                        <Route path="/reception/reports" element={<ReceptionistReports />}/>
                    </Route>
                </Route>


                {/* ================================= */}
                {/* BILLING */}
                {/* ================================= */}

                <Route
                    element={<ProtectedRoute allowedRoles={["BILLING", "ADMIN"]}/>}>
                    <Route path="/billing" element={<BillingDashboard />}>
                        <Route index element={<BillingHome />}/>
                        <Route path="new" element={<NewBill />}/>
                        <Route path="receipt/:billNumber" element={<BillReceipt />}/>
                        <Route path="reports" element={<BillingReports />}/>
                    </Route>
                </Route>

            </Routes>

        </BrowserRouter>
      
    </>
  )
}

export default App
