import { Routes, Route } from 'react-router-dom'
import './App.css'
import Layout from './components/Layout'
import Home from './pages/Home'
import About from './pages/About'
import Etiquetado from './pages/Etiquetado'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/acerca" element={<About />} />
        <Route path="/etiquetado" element={<Etiquetado />} />
      </Route>
    </Routes>
  )
}
