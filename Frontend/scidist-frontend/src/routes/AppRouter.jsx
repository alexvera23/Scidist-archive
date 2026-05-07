import { BrowserRouter, Routes, Route } from 'react-router-dom'

import Login from '../pages/Scidist'
import AuthPage from '../pages/AuthPage'
import Dashboard from '../pages/Dashboard'
import Scidist from '../pages/Scidist'
import AdminDashboard from '../pages/Dashboard-admi'

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Scidist />} />
        <Route path="/auth" element={< AuthPage/>} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path='/dashboard-admi'element={<AdminDashboard/>} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter