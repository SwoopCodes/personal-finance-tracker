import React, { useState } from 'react';
import './Styles/Register.css';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault(); // Prevent page refresh
    
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      // Create form data to send
      const formData = new FormData();
      formData.append('username-input', username);
      formData.append('email-input', email);
      formData.append('password-input', password);
      
      const response = await fetch('http://localhost:5000/api/register', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let message = response.status === 429
          ? 'Too many attempts, please try again later'
          : 'Registration failed';
        try {
          const errData = await response.json();
          message = errData.error || errData.message || message;
        } catch {
          // response body wasn't JSON (e.g. rate-limit page) — keep the status-based message
        }
        setErrorMessage(message);
        return;
      }

      const data = await response.json();

      if (data.success) {
        setIsRegistered(true); // Show success message
        setUsername('');
        setEmail('');
        setPassword('');
      } else {
        setErrorMessage(data.message || 'Registration failed');
      }
    } catch (error) {
      setErrorMessage('Network error: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // If registration is successful, show confirmation
  if (isRegistered) {
    return (
      <div className="register-container">
        <div className="register-card">
          <div className="success-message">
            <h2>✅ Registration Successful!</h2>
            <p>Your account has been created successfully.</p>
            <p>You can now log in with your credentials.</p>
            <a href="/Login" className="btn btn-register-submit" style={{display: 'inline-block', marginTop: '20px'}}>
              Go to Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="register-container">
      <div className="register-card">
        <h1 className="register-title">Create Account</h1>

        {errorMessage && (
          <div style={{color: 'red', marginBottom: '10px', textAlign: 'center'}}>
            {errorMessage}
          </div>
        )}

        <form className="register-form" onSubmit={handleRegister}>
          <div className="input-group">
            <label className="input-label">Username</label>
            <input
              type="text"
              className="register-input"
              name='username-input'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              required
              disabled={isLoading}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Email</label>
            <input
              type="email"
              className="register-input"
              name='email-input'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={isLoading}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <input
              type="password"
              className="register-input"
              name='password-input'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              required
              disabled={isLoading}
            />
          </div>

          <button type="submit" className="btn btn-register-submit" disabled={isLoading}>
            {isLoading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p className="login-link">
          Already have an account? <a href='/Login'>Log in</a>
        </p>
      </div>
    </div>
  );
};

export default Register;