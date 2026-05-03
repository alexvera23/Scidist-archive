import { BrowserRouter, Routes, Route } from 'react-router-dom'

import Login from '../pages/Login'
import AuthPage from '../pages/AuthPage'
import Dashboard from '../pages/Dashboard'

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/Login" element={<Login />} />
        <Route path="/" element={< AuthPage/>} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter