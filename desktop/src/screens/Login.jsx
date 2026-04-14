import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiUser, FiUsers, FiUserPlus, FiServer, FiCheck } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { adminLogin, employeeLogin } from '../services/api/auth';
import { setServerUrl, getServerUrl } from '../services/api';

const Login = () => {
    const navigate = useNavigate();
    const { checkAuth } = useAuth();
    const { loadBusiness } = useBusiness();

    // Login type: 'admin' or 'employee'
    const [loginType, setLoginType] = useState('admin');

    // Form fields
    const [email, setEmail] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showServerConfig, setShowServerConfig] = useState(false);
    const [serverInput, setServerInput] = useState(getServerUrl());
    const [serverSaved, setServerSaved] = useState(false);

    const handleSaveServer = () => {
        if (serverInput.trim()) {
            setServerUrl(serverInput.trim());
            setServerSaved(true);
            setTimeout(() => setServerSaved(false), 2000);
        }
    };

    const handleAdminLogin = async () => {
        setError('');
        setLoading(true);

        try {
            const response = await adminLogin(email, password);

            if (response.data.token) {
                // Clear all old data
                localStorage.removeItem('admin');
                localStorage.removeItem('employee');
                localStorage.removeItem('counterUser');
                localStorage.removeItem('business');
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');

                // Store new session
                localStorage.setItem('token', response.data.token);
                if (response.data.refreshToken) {
                    localStorage.setItem('refreshToken', response.data.refreshToken);
                }
                if (response.data.admin) {
                    localStorage.setItem('admin', JSON.stringify(response.data.admin));
                    localStorage.setItem('user', JSON.stringify(response.data.admin));
                }
                if (response.data.business) {
                    localStorage.setItem('business', JSON.stringify(response.data.business));
                }

                // Update auth and business contexts, then navigate
                checkAuth();
                loadBusiness();
                navigate('/dashboard', { replace: true });
            }
        } catch (err) {
            console.error('Login error:', err);
            setError(err.response?.data?.message || 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    const handleEmployeeLogin = async () => {
        setError('');
        setLoading(true);

        try {
            const response = await employeeLogin(employeeId.toLowerCase(), password);

            if (response.data.token) {
                // Clear all old data
                localStorage.removeItem('admin');
                localStorage.removeItem('employee');
                localStorage.removeItem('counterUser');
                localStorage.removeItem('business');
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');

                // Store new session
                localStorage.setItem('token', response.data.token);
                if (response.data.refreshToken) {
                    localStorage.setItem('refreshToken', response.data.refreshToken);
                }
                if (response.data.employee) {
                    localStorage.setItem('employee', JSON.stringify(response.data.employee));
                    localStorage.setItem('user', JSON.stringify(response.data.employee));
                }
                if (response.data.counterUser) {
                    localStorage.setItem('counterUser', JSON.stringify(response.data.counterUser));
                }
                if (response.data.business) {
                    localStorage.setItem('business', JSON.stringify(response.data.business));
                }

                // Check if password change required
                if (response.data.requirePasswordChange) {
                    // For now, just show alert - you can add change password screen later
                    alert('Password change required. Please change your password.');
                }

                // Update auth and business contexts, then navigate
                checkAuth();
                loadBusiness();
                navigate('/dashboard', { replace: true });
            }
        } catch (err) {
            console.error('Login error:', err);
            setError(err.response?.data?.message || 'Invalid Employee ID or password');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (loginType === 'admin') {
            handleAdminLogin();
        } else {
            handleEmployeeLogin();
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4"
            style={{
                background: loginType === 'admin'
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
            }}
        >
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-white rounded-2xl shadow-lg mx-auto flex items-center justify-center mb-4">
                        {loginType === 'admin' ? (
                            <FiUsers size={40} className="text-indigo-500" />
                        ) : (
                            <FiUser size={40} className="text-pink-500" />
                        )}
                    </div>
                    <h1 className="text-3xl font-bold text-white">
                        {loginType === 'admin' ? 'Admin Login' : 'Employee Login'}
                    </h1>
                    <p className="text-white/80 mt-2">
                        {loginType === 'admin'
                            ? 'Sign in to manage your business'
                            : 'Sign in with your employee ID'
                        }
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Error message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                                {error}
                            </div>
                        )}

                        {/* Admin: Email field */}
                        {loginType === 'admin' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="admin@example.com"
                                        className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white text-slate-800 placeholder-slate-400"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {/* Employee: Employee ID field */}
                        {loginType === 'employee' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Employee ID
                                </label>
                                <div className="relative">
                                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={employeeId}
                                        onChange={(e) => setEmployeeId(e.target.value.toLowerCase())}
                                        placeholder="e.g., store@john"
                                        className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all bg-white text-slate-800 placeholder-slate-400"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full pl-12 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white text-slate-800 placeholder-slate-400"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <FiEyeOff /> : <FiEye />}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                                loginType === 'admin'
                                    ? 'bg-indigo-500 hover:bg-indigo-600'
                                    : 'bg-pink-500 hover:bg-pink-600'
                            }`}
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    {/* Toggle login type */}
                    <div className="mt-6 pt-6 border-t border-slate-200">
                        <button
                            onClick={() => {
                                setLoginType(loginType === 'admin' ? 'employee' : 'admin');
                                setError('');
                            }}
                            className="w-full flex items-center justify-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
                        >
                            {loginType === 'admin' ? (
                                <>
                                    <FiUser />
                                    <span>Login as Employee instead</span>
                                </>
                            ) : (
                                <>
                                    <FiUsers />
                                    <span>Login as Admin instead</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Server Config */}
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={() => setShowServerConfig(!showServerConfig)}
                            className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 text-xs transition-colors"
                        >
                            <FiServer size={12} />
                            <span>Server Settings</span>
                        </button>
                        {showServerConfig && (
                            <div className="mt-3 space-y-2">
                                <label className="block text-xs font-medium text-slate-500">Server URL</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={serverInput}
                                        onChange={(e) => setServerInput(e.target.value)}
                                        placeholder="http://192.168.1.100:3000"
                                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800 placeholder-slate-400"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSaveServer}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                                            serverSaved ? 'bg-green-500' : 'bg-indigo-500 hover:bg-indigo-600'
                                        }`}
                                    >
                                        {serverSaved ? <FiCheck size={16} /> : 'Save'}
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400">Change this to connect to a server on your network</p>
                            </div>
                        )}
                    </div>

                    {/* Create Account */}
                    <div className="mt-4 text-center">
                        <Link
                            to="/signup"
                            className="inline-flex items-center gap-2 text-sm text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
                        >
                            <FiUserPlus />
                            Create Account
                        </Link>
                    </div>
                </div>

                {/* Keyboard shortcut hint */}
                <p className="text-center text-white/60 text-sm mt-6">
                    Press <kbd className="px-2 py-1 bg-white/20 rounded">Ctrl+Shift+I</kbd> to open DevTools
                </p>
            </div>
        </div>
    );
};

export default Login;
