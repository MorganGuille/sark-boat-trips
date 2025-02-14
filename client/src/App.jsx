import { BrowserRouter as Router, Route, Routes } from "react-router";

import Home from './views/home';

import './App.css'
import Navbar from './components/navbar';
import Bookings from './components/bookings';
import Charters from './components/charters'


function App() {

  return (
    <>
      <Router>
        <Navbar />
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/bookings' element={<Bookings />} />
          <Route path='/charters' element={<Charters />} />
        </Routes>
      </Router>



      {/* <Footer /> */}
    </>
  )
}

export default App
