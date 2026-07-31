import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Styles/Login.css'; // external styles

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogged, setLogged] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const nav = useNavigate()


  const handleLogin = async (e) => {
    e.preventDefault();

    try{
      const formData = new FormData();
      formData.append('username-input', username);
      formData.append('password-input', password);

      console.log("pressed login button....")

      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })

      if (!response.ok) {
        let message = response.status === 429
          ? 'Too many attempts, please try again later'
          : 'Login failed';
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

      if(data.success){
        setLogged(true);
      }  else {
        setErrorMessage(data.message || 'Registration failed');
      }

    } catch(error){
        setErrorMessage('NETWORK: ' + error.message)
        setUsername('')
        setPassword('')
    }

  };

  if(isLogged){
    nav('/Dashboard')
  }

  // navigate to registration page
  const handleRegister = () => {
    nav('/Register')  
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Login</h1>

        {errorMessage && (
          <div style={{color: 'red', marginBottom: '10px', textAlign: 'center'}}>
            {errorMessage}
          </div>
        )}

        <form className="login-form" onSubmit={handleLogin}>
          <div className="input-group">
            <label className="input-label">Username</label>
            <input
              type="text"
              className="login-input"
              value={username}
              name='username-input'
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
            />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input
              type="password"
              className="login-input"
              value={password}
              name='password-input'
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          <div className="button-group">
            <button type="submit" className="btn btn-login">
              Login
            </button>
            <button type="button" className="btn btn-register" onClick={handleRegister}>
              Register
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;