import React, { Component } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Error Boundary to catch React errors
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('React Error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-d-bg p-8">
                    <div className="max-w-lg bg-white dark:bg-d-card rounded-xl p-6 shadow-lg">
                        <h1 className="text-xl font-bold text-red-600 dark:text-d-red mb-4">Something went wrong</h1>
                        <p className="text-slate-600 dark:text-d-text mb-4">{this.state.error?.message}</p>
                        <pre className="bg-slate-100 dark:bg-d-elevated p-4 rounded text-xs overflow-auto max-h-48 mb-4 text-slate-800 dark:text-d-text">
                            {this.state.error?.stack}
                        </pre>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                            Reload App
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// Screens
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import Sales from './screens/Sales';
import Products from './screens/Products';
import Employees from './screens/Employees';
import Receipts from './screens/Receipts';
import Expenses from './screens/Expenses';
import Reports from './screens/Reports';
import Settings from './screens/Settings';
import Pending from './screens/Pending';
import Profile from './screens/Profile';
import Returns from './screens/Returns';
import Vendors from './screens/Vendors';

// Layout
import Layout from './components/Layout';

// Loading component
const Loading = () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-d-bg">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 dark:text-d-muted">Loading...</p>
        </div>
    </div>
);

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <Loading />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
};

// Public route - redirect to dashboard if already logged in
const PublicRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return <Loading />;
    }

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

function AppContent() {
    const { loading } = useAuth();

    if (loading) {
        return <Loading />;
    }

    return (
        <Routes>
            <Route
                path="/login"
                element={
                    <PublicRoute>
                        <Login />
                    </PublicRoute>
                }
            />
            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Dashboard />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Dashboard />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/sales"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Sales />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/products"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Products />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/employees"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Employees />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/receipts"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Receipts />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/expenses"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Expenses />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/reports"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Reports />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/settings"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Settings />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/pending"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Pending />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/profile"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Profile />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/returns"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Returns />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/vendors"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Vendors />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}

function App() {
    return (
        <ErrorBoundary>
            <AppContent />
        </ErrorBoundary>
    );
}

// For HMR compatibility
App.displayName = 'App';

export default App;
