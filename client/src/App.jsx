import { BrowserRouter as Router, Route, Routes } from "react-router";

import Home from './views/home';

import './App.css'
import Navbar from './components/navbar';
import MobileNav from './components/mobilenav'
import Bookings from './components/bookings';
import Charters from './components/charters'
import Dashboard from "./views/dashboard";


function App() {

  return (
    <>
      <Router>
        <Navbar />
        <MobileNav />
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/bookings' element={<Bookings />} />
          <Route path='/charters' element={<Charters />} />
          <Route path='/dashboard' element={<Dashboard />} />
        </Routes>
      </Router>



      {/* <Footer /> */}
    </>
  )
}

export default App
