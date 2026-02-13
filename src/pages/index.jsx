import Layout from "./Layout.jsx";

import Home from "./Home";
import AdminDashboard from "./AdminDashboard";
import Settings from "./Settings";
import ForgotPassword from "@/components/auth/ForgotPassword";
import ResetPassword from "@/components/auth/ResetPassword";
import SetPassword from "@/components/auth/SetPassword";
import RequestAccess from "@/components/auth/RequestAccess";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    Home: Home,
    AdminDashboard: AdminDashboard,
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);

    // Password reset and access request pages don't need Layout wrapper
    if (['/forgot-password', '/reset-password', '/set-password', '/request-access'].includes(location.pathname)) {
        return (
            <Routes>
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/set-password" element={<SetPassword />} />
                <Route path="/request-access" element={<RequestAccess />} />
            </Routes>
        );
    }

    return (
        <Layout currentPageName={currentPage}>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/home" element={<Home />} />
                <Route path="/Home" element={<Home />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/settings" element={<Settings />} />
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}