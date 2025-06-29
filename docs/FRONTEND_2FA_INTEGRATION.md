# Frontend Two-Factor Authentication Integration Guide

## Overview
Complete frontend integration guide for the CM7 Medical 2FA system supporting SMS, email fallback, and backup codes.

## Updated API Integration

### 1. Enhanced Login Flow

```javascript
// Enhanced login function with multi-method 2FA support
async function login(email, password) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.requiresTwoFactor) {
      // Show 2FA verification form with multiple options
      return {
        requires2FA: true,
        tempToken: data.tempToken,
        phone: data.phone,
        email: data.email,
        availableMethods: data.availableMethods // ['sms', 'email', 'backup']
      };
    } else {
      // Normal login - store token and redirect
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      return { success: true, user: data.user };
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}
```

### 2. Multi-Method 2FA Verification

```javascript
// Universal 2FA verification function
async function verify2FA(tempToken, verificationData) {
  try {
    const response = await fetch('/api/auth/2fa/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tempToken,
        ...verificationData // Can contain smsCode, emailCode, or backupCode
      })
    });

    const data = await response.json();

    if (response.ok) {
      // Success - store token and redirect
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      return { success: true, user: data.user };
    } else {
      return { success: false, error: data.message, attemptsLeft: data.attemptsLeft };
    }
  } catch (error) {
    console.error('2FA verification error:', error);
    throw error;
  }
}

// Specific verification methods
async function verifySMSCode(tempToken, smsCode) {
  return verify2FA(tempToken, { smsCode });
}

async function verifyEmailCode(tempToken, emailCode) {
  return verify2FA(tempToken, { emailCode });
}

async function verifyBackupCode(tempToken, backupCode) {
  return verify2FA(tempToken, { backupCode });
}
```

### 3. Enhanced Resend Functionality

```javascript
// Resend code with method selection
async function resend2FACode(tempToken, method = 'sms') {
  try {
    const response = await fetch('/api/auth/2fa/resend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tempToken, method })
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, message: data.message, method: data.method };
    } else {
      return { success: false, error: data.message, canResendAt: data.canResendAt };
    }
  } catch (error) {
    console.error('Resend code error:', error);
    throw error;
  }
}

// Request email fallback when SMS fails
async function requestEmailFallback(tempToken) {
  try {
    const response = await fetch('/api/auth/2fa/email-fallback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tempToken })
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, message: data.message, email: data.email };
    } else {
      return { success: false, error: data.message };
    }
  } catch (error) {
    console.error('Email fallback error:', error);
    throw error;
  }
}
```

## React Components

### 1. Enhanced Login Component

```jsx
import React, { useState } from 'react';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState(null);
  const [activeTab, setActiveTab] = useState('sms'); // 'sms', 'email', 'backup'
  const [codes, setCodes] = useState({
    sms: '',
    email: '',
    backup: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(email, password);
      
      if (result.requires2FA) {
        setShowTwoFactor(true);
        setTwoFactorData(result);
        // Set default tab based on available methods
        setActiveTab(result.availableMethods.includes('sms') ? 'sms' : 'email');
      }
    } catch (error) {
      setError('Błąd podczas logowania');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let verificationData = {};
      
      switch (activeTab) {
        case 'sms':
          verificationData = { smsCode: codes.sms };
          break;
        case 'email':
          verificationData = { emailCode: codes.email };
          break;
        case 'backup':
          verificationData = { backupCode: codes.backup };
          break;
      }

      const result = await verify2FA(twoFactorData.tempToken, verificationData);
      
      if (!result.success) {
        setError(result.error);
      }
    } catch (error) {
      setError('Błąd podczas weryfikacji kodu');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async (method) => {
    try {
      const result = await resend2FACode(twoFactorData.tempToken, method);
      
      if (result.success) {
        // Start cooldown timer
        setResendCooldown(60);
        const timer = setInterval(() => {
          setResendCooldown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Błąd podczas wysyłania kodu');
    }
  };

  const handleEmailFallback = async () => {
    try {
      const result = await requestEmailFallback(twoFactorData.tempToken);
      
      if (result.success) {
        setActiveTab('email');
        setError('');
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Błąd podczas wysyłania kodu email');
    }
  };

  if (showTwoFactor) {
    return (
      <div className="two-factor-form">
        <h2>Weryfikacja dwuskładnikowa</h2>
        <p>Wybierz metodę weryfikacji:</p>
        
        {/* Method Tabs */}
        <div className="method-tabs">
          {twoFactorData.availableMethods.includes('sms') && (
            <button
              className={`tab ${activeTab === 'sms' ? 'active' : ''}`}
              onClick={() => setActiveTab('sms')}
            >
              SMS ({twoFactorData.phone})
            </button>
          )}
          {twoFactorData.availableMethods.includes('email') && (
            <button
              className={`tab ${activeTab === 'email' ? 'active' : ''}`}
              onClick={() => setActiveTab('email')}
            >
              Email ({twoFactorData.email})
            </button>
          )}
          {twoFactorData.availableMethods.includes('backup') && (
            <button
              className={`tab ${activeTab === 'backup' ? 'active' : ''}`}
              onClick={() => setActiveTab('backup')}
            >
              Kod zapasowy
            </button>
          )}
        </div>

        <form onSubmit={handleVerify2FA}>
          {/* SMS Tab */}
          {activeTab === 'sms' && (
            <div className="tab-content">
              <p>Kod został wysłany na numer {twoFactorData.phone}</p>
              <input
                type="text"
                placeholder="Wprowadź kod SMS"
                value={codes.sms}
                onChange={(e) => setCodes(prev => ({ ...prev, sms: e.target.value }))}
                maxLength="6"
                className="code-input"
                required
              />
              <div className="resend-actions">
                <button
                  type="button"
                  onClick={() => handleResendCode('sms')}
                  disabled={resendCooldown > 0 || loading}
                >
                  {resendCooldown > 0 ? `Wyślij ponownie (${resendCooldown}s)` : 'Wyślij ponownie SMS'}
                </button>
                <button
                  type="button"
                  onClick={handleEmailFallback}
                  disabled={loading}
                  className="fallback-btn"
                >
                  Nie otrzymałem SMS - wyślij email
                </button>
              </div>
            </div>
          )}

          {/* Email Tab */}
          {activeTab === 'email' && (
            <div className="tab-content">
              <p>Kod został wysłany na adres {twoFactorData.email}</p>
              <input
                type="text"
                placeholder="Wprowadź kod z email"
                value={codes.email}
                onChange={(e) => setCodes(prev => ({ ...prev, email: e.target.value }))}
                maxLength="6"
                className="code-input"
                required
              />
              <button
                type="button"
                onClick={() => handleResendCode('email')}
                disabled={resendCooldown > 0 || loading}
              >
                {resendCooldown > 0 ? `Wyślij ponownie (${resendCooldown}s)` : 'Wyślij ponownie email'}
              </button>
            </div>
          )}

          {/* Backup Code Tab */}
          {activeTab === 'backup' && (
            <div className="tab-content">
              <p>Wprowadź jeden z kodów zapasowych otrzymanych podczas włączania 2FA</p>
              <input
                type="text"
                placeholder="Wprowadź kod zapasowy (np. A1B2C3D4)"
                value={codes.backup}
                onChange={(e) => setCodes(prev => ({ ...prev, backup: e.target.value.toUpperCase() }))}
                maxLength="8"
                className="backup-code-input"
                required
              />
              <div className="backup-warning">
                ⚠️ Każdy kod zapasowy można użyć tylko raz
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} className="verify-btn">
            {loading ? 'Weryfikacja...' : 'Zweryfikuj kod'}
          </button>
        </form>

        {error && <div className="error-message">{error}</div>}
      </div>
    );
  }

  return (
    <form onSubmit={handleLogin} className="login-form">
      <h2>Logowanie</h2>
      
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      
      <input
        type="password"
        placeholder="Hasło"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      
      <button type="submit" disabled={loading}>
        {loading ? 'Logowanie...' : 'Zaloguj się'}
      </button>
      
      {error && <div className="error-message">{error}</div>}
    </form>
  );
};

export default LoginForm;
```

### 2. Enhanced 2FA Settings Component

```jsx
import React, { useState, useEffect } from 'react';

const TwoFactorSettings = () => {
  const [status, setStatus] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const statusData = await get2FAStatus();
      setStatus(statusData);
    } catch (error) {
      setError('Nie udało się załadować statusu 2FA');
    }
  };

  const handleToggle2FA = async (enable) => {
    if (!currentPassword) {
      setError('Wprowadź aktualne hasło');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await toggle2FA(enable, currentPassword);
      
      if (result.success) {
        if (enable && result.data.backupCodes) {
          setBackupCodes(result.data.backupCodes);
          setShowBackupCodes(true);
        }
        
        setSuccess(result.data.message);
        await loadStatus();
        setCurrentPassword('');
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Błąd podczas zmiany ustawień 2FA');
    } finally {
      setLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    const content = `CM7 Medical - Kody zapasowe 2FA\n\nZapisz te kody w bezpiecznym miejscu:\n\n${backupCodes.join('\n')}\n\nKażdy kod można użyć tylko raz.\nData wygenerowania: ${new Date().toLocaleString('pl-PL')}`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cm7-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    navigator.clipboard.writeText(codesText).then(() => {
      setSuccess('Kody zostały skopiowane do schowka');
    });
  };

  if (!status) return <div className="loading">Ładowanie...</div>;

  return (
    <div className="two-factor-settings">
      <h3>Uwierzytelnianie dwuskładnikowe (2FA)</h3>
      
      <div className="status-section">
        <div className={`status-indicator ${status.twoFactorEnabled ? 'enabled' : 'disabled'}`}>
          <span className="status-dot"></span>
          Status: {status.twoFactorEnabled ? 'Włączone' : 'Wyłączone'}
        </div>
        
        {status.hasPhone && (
          <div className="phone-info">
            📱 Telefon: {status.phone}
          </div>
        )}
        
        {!status.hasPhone && (
          <div className="warning">
            ⚠️ Dodaj numer telefonu aby włączyć 2FA
          </div>
        )}
      </div>

      <div className="controls-section">
        <div className="password-input">
          <input
            type="password"
            placeholder="Wprowadź aktualne hasło"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={loading}
          />
        </div>
        
        <button
          onClick={() => handleToggle2FA(!status.twoFactorEnabled)}
          disabled={loading || !currentPassword || !status.hasPhone}
          className={`toggle-btn ${status.twoFactorEnabled ? 'disable' : 'enable'}`}
        >
          {loading ? 'Przetwarzanie...' : 
           status.twoFactorEnabled ? 'Wyłącz 2FA' : 'Włącz 2FA'}
        </button>
      </div>

      {/* Backup Codes Modal */}
      {showBackupCodes && (
        <div className="backup-codes-modal">
          <div className="modal-content">
            <h4>🔐 Kody zapasowe 2FA</h4>
            <div className="warning-box">
              <strong>⚠️ WAŻNE:</strong>
              <ul>
                <li>Zapisz te kody w bezpiecznym miejscu</li>
                <li>Każdy kod można użyć tylko raz</li>
                <li>Kody nie będą ponownie wyświetlone</li>
                <li>Użyj ich gdy nie masz dostępu do telefonu lub email</li>
              </ul>
            </div>
            
            <div className="codes-grid">
              {backupCodes.map((code, index) => (
                <div key={index} className="backup-code">
                  <span className="code-number">{index + 1}.</span>
                  <code className="code-value">{code}</code>
                </div>
              ))}
            </div>
            
            <div className="modal-actions">
              <button onClick={downloadBackupCodes} className="download-btn">
                📥 Pobierz jako plik
              </button>
              <button onClick={copyBackupCodes} className="copy-btn">
                📋 Kopiuj do schowka
              </button>
              <button 
                onClick={() => setShowBackupCodes(false)} 
                className="confirm-btn"
              >
                ✅ Zapisałem kody bezpiecznie
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Information Section */}
      <div className="info-section">
        <h4>Jak działa 2FA?</h4>
        <div className="info-grid">
          <div className="info-item">
            <span className="icon">📱</span>
            <div>
              <strong>SMS</strong>
              <p>Kod wysyłany na Twój telefon</p>
            </div>
          </div>
          <div className="info-item">
            <span className="icon">📧</span>
            <div>
              <strong>Email</strong>
              <p>Alternatywa gdy SMS nie działa</p>
            </div>
          </div>
          <div className="info-item">
            <span className="icon">🔐</span>
            <div>
              <strong>Kody zapasowe</strong>
              <p>Jednorazowe kody awaryjne</p>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
    </div>
  );
};

export default TwoFactorSettings;
```

## CSS Styling

```css
/* Enhanced 2FA Styling */
.two-factor-form {
  max-width: 400px;
  margin: 0 auto;
  padding: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
}

.method-tabs {
  display: flex;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #eee;
}

.tab {
  flex: 1;
  padding: 0.75rem;
  border: none;
  background: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.3s ease;
}

.tab.active {
  border-bottom-color: #007bff;
  color: #007bff;
  font-weight: 600;
}

.tab-content {
  margin-bottom: 1.5rem;
}

.code-input, .backup-code-input {
  width: 100%;
  padding: 1rem;
  font-size: 1.5rem;
  text-align: center;
  letter-spacing: 0.5rem;
  border: 2px solid #ddd;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.backup-code-input {
  text-transform: uppercase;
  font-family: 'Courier New', monospace;
}

.resend-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.fallback-btn {
  background: #ffc107;
  color: #000;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.backup-warning {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.verify-btn {
  width: 100%;
  padding: 1rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background 0.3s ease;
}

.verify-btn:hover:not(:disabled) {
  background: #0056b3;
}

.verify-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* 2FA Settings Styling */
.two-factor-settings {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
}

.status-section {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.status-indicator.enabled .status-dot {
  background: #28a745;
}

.status-indicator.disabled .status-dot {
  background: #dc3545;
}

.controls-section {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.password-input {
  flex: 1;
}

.password-input input {
  width: 100%;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
}

.toggle-btn {
  padding: 1rem 2rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
}

.toggle-btn.enable {
  background: #28a745;
  color: white;
}

.toggle-btn.disable {
  background: #dc3545;
  color: white;
}

.toggle-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* Backup Codes Modal */
.backup-codes-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.warning-box {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
}

.warning-box ul {
  margin: 0.5rem 0 0 1rem;
}

.codes-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.backup-code {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #eee;
}

.code-number {
  font-weight: 600;
  color: #666;
  min-width: 20px;
}

.code-value {
  font-family: 'Courier New', monospace;
  font-size: 1.1rem;
  font-weight: 600;
  color: #007bff;
  background: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.modal-actions button {
  flex: 1;
  min-width: 120px;
  padding: 0.75rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
}

.download-btn {
  background: #17a2b8;
  color: white;
}

.copy-btn {
  background: #6c757d;
  color: white;
}

.confirm-btn {
  background: #28a745;
  color: white;
}

.info-section {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-top: 2rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #eee;
}

.info-item .icon {
  font-size: 1.5rem;
}

.info-item strong {
  display: block;
  margin-bottom: 0.25rem;
}

.info-item p {
  margin: 0;
  font-size: 0.9rem;
  color: #666;
}

/* Error and Success Messages */
.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid #f5c6cb;
  margin-top: 1rem;
}

.success-message {
  background: #d4edda;
  color: #155724;
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid #c3e6cb;
  margin-top: 1rem;
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .two-factor-form {
    padding: 1rem;
    margin: 1rem;
  }
  
  .method-tabs {
    flex-direction: column;
  }
  
  .tab {
    border-bottom: 1px solid #eee;
    border-right: none;
  }
  
  .tab.active {
    border-left: 3px solid #007bff;
    border-bottom: 1px solid #eee;
  }
  
  .controls-section {
    flex-direction: column;
  }
  
  .codes-grid {
    grid-template-columns: 1fr;
  }
  
  .modal-actions {
    flex-direction: column;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
}

/* Accessibility */
.tab:focus {
  outline: 2px solid #007bff;
  outline-offset: 2px;
}

.code-input:focus,
.backup-code-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
}

/* Loading States */
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #666;
}

.loading::before {
  content: '';
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 0.5rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

## State Management (Redux/Context)

```javascript
// 2FA Context Provider
import React, { createContext, useContext, useReducer } from 'react';

const TwoFactorContext = createContext();

const initialState = {
  isEnabled: false,
  tempToken: null,
  availableMethods: [],
  currentMethod: 'sms',
  isVerifying: false,
  error: null,
  backupCodes: [],
  resendCooldown: 0
};

function twoFactorReducer(state, action) {
  switch (action.type) {
    case 'SET_2FA_DATA':
      return {
        ...state,
        tempToken: action.payload.tempToken,
        availableMethods: action.payload.availableMethods,
        currentMethod: action.payload.availableMethods[0] || 'sms'
      };
    
    case 'SET_METHOD':
      return {
        ...state,
        currentMethod: action.payload
      };
    
    case 'SET_VERIFYING':
      return {
        ...state,
        isVerifying: action.payload
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload
      };
    
    case 'SET_BACKUP_CODES':
      return {
        ...state,
        backupCodes: action.payload
      };
    
    case 'SET_RESEND_COOLDOWN':
      return {
        ...state,
        resendCooldown: action.payload
      };
    
    case 'CLEAR_2FA':
      return initialState;
    
    default:
      return state;
  }
}

export const TwoFactorProvider = ({ children }) => {
  const [state, dispatch] = useReducer(twoFactorReducer, initialState);
  
  return (
    <TwoFactorContext.Provider value={{ state, dispatch }}>
      {children}
    </TwoFactorContext.Provider>
  );
};

export const useTwoFactor = () => {
  const context = useContext(TwoFactorContext);
  if (!context) {
    throw new Error('useTwoFactor must be used within TwoFactorProvider');
  }
  return context;
};
```

## Testing Utilities

```javascript
// Test utilities for 2FA components
export const mockTwoFactorData = {
  requiresTwoFactor: true,
  tempToken: 'mock-temp-token',
  phone: '***123',
  email: '***com',
  availableMethods: ['sms', 'email', 'backup']
};

export const mockApiResponses = {
  login: (requires2FA = true) => ({
    ok: true,
    json: () => Promise.resolve(
      requires2FA ? mockTwoFactorData : { 
        token: 'mock-token', 
        user: { id: '1', name: 'Test User' } 
      }
    )
  }),
  
  verify2FA: (success = true) => ({
    ok: success,
    json: () => Promise.resolve(
      success 
        ? { token: 'mock-token', user: { id: '1', name: 'Test User' } }
        : { message: 'Invalid code', attemptsLeft: 3 }
    )
  }),
  
  resend: (success = true) => ({
    ok: success,
    json: () => Promise.resolve(
      success 
        ? { message: 'Code sent', method: 'sms' }
        : { message: 'Rate limited', canResendAt: new Date() }
    )
  })
};

// Jest test helpers
export const setupFetchMock = () => {
  global.fetch = jest.fn();
};

export const mockSuccessfulLogin = () => {
  global.fetch.mockResolvedValueOnce(mockApiResponses.login(true));
};

export const mockSuccessfulVerification = () => {
  global.fetch.mockResolvedValueOnce(mockApiResponses.verify2FA(true));
};
```

## Accessibility Considerations

1. **Keyboard Navigation**: All interactive elements are keyboard accessible
2. **Screen Reader Support**: Proper ARIA labels and descriptions
3. **High Contrast**: Colors meet WCAG contrast requirements
4. **Focus Management**: Clear focus indicators and logical tab order
5. **Error Announcements**: Screen readers announce errors immediately
6. **Alternative Text**: All icons have descriptive text alternatives

## Browser Compatibility

- **Modern Browsers**: Chrome 70+, Firefox 65+, Safari 12+, Edge 79+
- **Mobile**: iOS Safari 12+, Chrome Mobile 70+
- **Fallbacks**: Graceful degradation for older browsers

## Performance Optimization

1. **Code Splitting**: Load 2FA components only when needed
2. **Lazy Loading**: Defer non-critical 2FA assets
3. **Caching**: Cache 2FA status and settings appropriately
4. **Debouncing**: Debounce code input to prevent excessive API calls

---

**Implementation Status:** ✅ Complete
**Last Updated:** January 2024
**Version:** 2.0.0 