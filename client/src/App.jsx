import { BrowserRouter as Router, Route, Routes } from "react-router-dom";

import Home from './views/home';

import './App.css'
import Navbar from './components/navbar';
import Bookings from './views/bookings';


function App() {

  return (
    <>
      <Router>
        <Navbar />
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/bookings' element={<Bookings />} />
        </Routes>
      </Router>



      {/* <Footer /> */}
    </>
  )
}

export default App
