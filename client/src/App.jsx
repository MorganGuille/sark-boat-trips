import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router";
import './App.css';

import Navbar from './components/navbar';

import Home from './views/home';
import Bookings from './components/bookings';
import Charters from './views/charters';
import Dashboard from "./views/dashboard";
import Success from "./views/success";
import Canceled from "./views/canceled";
import ManageBooking from "./views/manageBooking";
import TermsPage from "./views/termsPage";
import PrivacyPage from "./views/privacyPage";
import GiftVouchers from "./views/giftVouchers";
import VoucherThanks from "./views/voucherThanks";
import NotFound from "./views/notfound";

import Footer from './components/footer';
import ConfirmProvider from './components/confirmDialog';

const Wrapper = ({ children }) => {
  const location = useLocation();

  useEffect(() => {
    // Scroll to the top of the page when the route changes, or to the section a link asked for
    // (the menu's "/#theTour" from another page)
    const section = location.hash && document.getElementById(location.hash.slice(1));
    if (section) section.scrollIntoView();
    else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.pathname, location.hash]);

  return children;
};

function App() {

  return (
    <ConfirmProvider>

      <Wrapper>
        <Navbar />
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/bookings' element={<Bookings />} />
          <Route path='/charters' element={<Charters />} />
          <Route path='/dashboard' element={<Dashboard />} />
          <Route path='/success' element={<Success />} />
          <Route path='/canceled' element={<Canceled />} />
          <Route path='/manage/:token' element={<ManageBooking />} />
          <Route path='/terms' element={<TermsPage />} />
          <Route path='/privacy' element={<PrivacyPage />} />
          <Route path='/gift-vouchers' element={<GiftVouchers />} />
          <Route path='/gift-vouchers/thanks' element={<VoucherThanks />} />
          <Route path='*' element={<NotFound />} />
        </Routes>
      </Wrapper>

      <Footer />
    </ConfirmProvider>
  )
}

export default App
