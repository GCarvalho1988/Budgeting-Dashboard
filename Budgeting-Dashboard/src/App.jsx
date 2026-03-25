import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Categories from './pages/Categories'
import YearVsYear from './pages/YearVsYear'
import Transactions from './pages/Transactions'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Overview />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/year-vs-year" element={<YearVsYear />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
