import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/dashboard/Dashboard';
import api from './services/api';

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
        } catch (e) {
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  if (loading) return <div className="bg-slate-900 h-screen text-white flex items-center justify-center">Loading...</div>;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login onLogin={setUser} />} />
        <Route
          path="/"
          element={
            user ? (
              <Dashboard
                currentRole={user.role}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </Router>
  );
};

import { useNavigate } from 'react-router-dom';

const Login: React.FC<{ onLogin: (u: any) => void }> = ({ onLogin }) => {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('password');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Attempting login...');
    try {
      const res = await api.post('/auth/login', { email, password });
      console.log('Login success:', res.data);
      localStorage.setItem('token', res.data.token);
      onLogin(res.data.user);
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err.response?.data || err.message);
      alert('Login failed: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="bg-slate-950 h-screen flex items-center justify-center text-white">
      <form onSubmit={handleSubmit} className="bg-slate-900 p-8 rounded-xl shadow-2xl border border-slate-800 w-96">
        <h2 className="text-2xl font-bold mb-6 text-blue-400">Jacadi BI Login</h2>
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-2">Email</label>
          <input
            className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
            value={email} onChange={e => setEmail(e.target.value)}
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm text-slate-400 mb-2">Password</label>
          <input
            type="password"
            className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
            value={password} onChange={e => setPassword(e.target.value)}
          />
        </div>
        <button className="w-full bg-blue-600 hover:bg-blue-500 p-3 rounded font-bold transition-colors">
          Enter Dashboard
        </button>
      </form>
    </div>
  );
};

export default App;
