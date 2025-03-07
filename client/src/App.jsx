import { useLayoutEffect, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router";
import './App.css';

import Navbar from './components/navbar';
import MobileNav from './components/mobilenav';

import Home from './views/home';
import Bookings from './components/bookings';
import Charters from './views/charters';
import Dashboard from "./views/dashboard";
import Success from "./views/success";
import Canceled from "./views/canceled";
import NotFound from "./views/notfound";

import Footer from './components/footer';

const Wrapper = ({ children }) => {
  const location = useLocation();

  useEffect(() => {
    // Scroll to the top of the page when the route changes
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.pathname]);

  return children;
};

function App() {

  return (
    <>
      <Router>
        <Wrapper>
          <Navbar />
          <MobileNav />
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/bookings' element={<Bookings />} />
            <Route path='/charters' element={<Charters />} />
            <Route path='/dashboard' element={<Dashboard />} />
            <Route path='/success' element={<Success />} />
            <Route path='/canceled' element={<Canceled />} />
            <Route path='*' element={<NotFound />} />
          </Routes>
        </Wrapper>
      </Router>
      <Footer />
    </>
  )
}

export default App
