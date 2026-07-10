import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, UserCheck, ShieldAlert } from 'lucide-react';

const Login = ({ setView }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user'); // user or admin
  const [localError, setLocalError] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');

  const { login, register, loading } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setLocalSuccess('');

    if (!email || !password || (isSignUp && !name)) {
      setLocalError('Please fill in all required fields');
      return;
    }

    try {
      if (isSignUp) {
        await register(name, email, password, role);
        setLocalSuccess('Registration successful! Redirecting...');
        setTimeout(() => {
          setView(role === 'admin' ? 'admin-dashboard' : 'events');
        }, 1500);
      } else {
        const loggedInUser = await login(email, password);
        setLocalSuccess('Login successful! Welcome back.');
        setTimeout(() => {
          setView(loggedInUser.role === 'admin' ? 'admin-dashboard' : 'events');
        }, 1500);
      }
    } catch (err) {
      setLocalError(err.message || 'Authentication failed. Please try again.');
    }
  };

  // Helper to prefill form for easy testing
  const handlePrefill = (type) => {
    setLocalError('');
    setIsSignUp(false);
    if (type === 'admin') {
      setEmail('admin@crowd.com');
      setPassword('admin123');
    } else {
      setEmail('user@crowd.com');
      setPassword('user123');
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '80vh',
      padding: '1rem'
    }}>
      <div className="glass-panel" style={{ 
        width: '100%', 
        maxWidth: '450px', 
        padding: '2.5rem 2rem', 
        border: '1px solid var(--border-glow)',
        boxShadow: '0 15px 35px rgba(255, 65, 108, 0.15)'
      }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            {isSignUp ? 'Sign up to register for global crowd events' : 'Sign in to access your dashboard'}
          </p>
        </div>

        {/* Tab Buttons */}
        <div style={{ 
          display: 'flex', 
          background: 'rgba(255,255,255,0.02)', 
          borderRadius: '10px', 
          padding: '0.25rem', 
          marginBottom: '2rem',
          border: '1px solid var(--border-light)'
        }}>
          <button 
            type="button"
            onClick={() => { setIsSignUp(false); setLocalError(''); }}
            style={{ 
              flex: 1, 
              padding: '0.6rem', 
              background: !isSignUp ? 'var(--primary-gradient)' : 'transparent',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'var(--transition-fast)'
            }}
          >
            Sign In
          </button>
          <button 
            type="button"
            onClick={() => { setIsSignUp(true); setLocalError(''); }}
            style={{ 
              flex: 1, 
              padding: '0.6rem', 
              background: isSignUp ? 'var(--primary-gradient)' : 'transparent',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'var(--transition-fast)'
            }}
          >
            Sign Up
          </button>
        </div>

        {/* Alerts */}
        {localError && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.2)', 
            color: 'var(--danger)', 
            padding: '0.75rem', 
            borderRadius: '8px', 
            fontSize: '0.85rem', 
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <ShieldAlert size={16} />
            <span>{localError}</span>
          </div>
        )}

        {localSuccess && (
          <div style={{ 
            background: 'rgba(16, 185, 129, 0.1)', 
            border: '1px solid rgba(16, 185, 129, 0.2)', 
            color: 'var(--success)', 
            padding: '0.75rem', 
            borderRadius: '8px', 
            fontSize: '0.85rem', 
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <UserCheck size={16} />
            <span>{localSuccess}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {isSignUp && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Enter your name" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ paddingLeft: '2.5rem' }}
                  required
                />
                <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="email" 
                className="form-control" 
                placeholder="you@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
                required
              />
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="password" 
                className="form-control" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
                required
              />
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          {isSignUp && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Account Role</label>
              <select 
                className="form-control" 
                value={role} 
                onChange={(e) => setRole(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                <option value="user" style={{ background: 'var(--bg-secondary)', color: 'white' }}>Attendee (User)</option>
                <option value="admin" style={{ background: 'var(--bg-secondary)', color: 'white' }}>Security / Staff (Admin)</option>
              </select>
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '0.75rem', padding: '0.85rem' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Demo Fast Credentials Widget */}
        <div style={{ 
          marginTop: '2.5rem', 
          borderTop: '1px solid var(--border-light)', 
          paddingTop: '1.5rem',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
            Demo Quick Logins
          </span>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '0.75rem' }}>
            <button 
              type="button" 
              onClick={() => handlePrefill('user')} 
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
            >
              User Account
            </button>
            <button 
              type="button" 
              onClick={() => handlePrefill('admin')} 
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
            >
              Admin Account
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
