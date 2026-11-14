import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  CheckCircle2,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { User } from '../../types';
import { FieldShiftEarth } from '../three/FieldShiftEarth';
import { authService } from '../../services/authService';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'signin' | 'signup' | 'verify';
  onClose: () => void;
  onSuccess: (user: User) => void;
}

const RESEND_COOLDOWN_SECONDS = 60;

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'signin',
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'verify' | 'forgot'>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);

  // 6-digit OTP array
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [timerSeconds, setTimerSeconds] = useState(RESEND_COOLDOWN_SECONDS);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [unverifiedSignInEmail, setUnverifiedSignInEmail] = useState<string | null>(null);
  const [duplicateSignupEmail, setDuplicateSignupEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const submittingRef = useRef(false);

  useEffect(() => {
    setMode(initialMode);
    setErrorMsg(null);
    setSuccessMsg(null);
    setUnverifiedSignInEmail(null);
    setDuplicateSignupEmail(null);
  }, [initialMode, isOpen]);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (mode !== 'verify' || timerSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [mode, timerSeconds]);

  // Auto-focus first OTP box when entering verification screen
  useEffect(() => {
    if (isOpen && mode === 'verify') {
      const id = setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 60);
      return () => clearTimeout(id);
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const isBusy = loading || resending || oauthLoading;

  // Handle OTP digit changes (numeric only + handles multi-digit mobile autofill)
  const handleOtpChange = (index: number, rawValue: string) => {
    setErrorMsg(null);
    const digitsOnly = rawValue.replace(/\D/g, '');

    if (!digitsOnly) {
      const nextOtp = [...otp];
      nextOtp[index] = '';
      setOtp(nextOtp);
      return;
    }

    if (digitsOnly.length > 1) {
      const nextOtp = [...otp];
      const chars = digitsOnly.slice(0, 6).split('');
      const startIdx = chars.length === 6 ? 0 : index;
      chars.forEach((char, offset) => {
        if (startIdx + offset < 6) {
          nextOtp[startIdx + offset] = char;
        }
      });
      setOtp(nextOtp);
      const focusIdx = Math.min(startIdx + chars.length - 1, 5);
      otpInputRefs.current[focusIdx]?.focus();
      return;
    }

    const nextOtp = [...otp];
    nextOtp[index] = digitsOnly;
    setOtp(nextOtp);

    if (index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const nextOtp = [...otp];
      nextOtp[index - 1] = '';
      setOtp(nextOtp);
      otpInputRefs.current[index - 1]?.focus();
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
      e.preventDefault();
    }
  };

  const handlePasteOtp = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    if (digits.length === 0) {
      setErrorMsg('Please paste a 6-digit numeric verification code.');
      return;
    }
    const nextOtp = ['', '', '', '', '', ''];
    digits.forEach((d, i) => {
      nextOtp[i] = d;
    });
    setOtp(nextOtp);
    otpInputRefs.current[Math.min(digits.length - 1, 5)]?.focus();
  };

  // Google OAuth Sign-In (independent of email OTP)
  const handleGoogleAuth = async () => {
    if (isBusy) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setOauthLoading(true);
    try {
      await authService.loginWithGoogle('/dashboard');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to connect to Google authentication.');
      setOauthLoading(false);
    }
  };

  // Sign Up Submission
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy || submittingRef.current) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setDuplicateSignupEmail(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim();

    if (!cleanName || !cleanEmail || !password) {
      setErrorMsg('Please complete all required fields.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!agreeTerms) {
      setErrorMsg('Please accept the Terms of Service & Privacy Policy.');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      const data = await authService.register({
        fullName: cleanName,
        email: cleanEmail,
        password,
      });

      if (data.autoConfirmed && data.user) {
        onSuccess(data.user);
        onClose();
        return;
      }

      setOtp(['', '', '', '', '', '']);
      setTimerSeconds(RESEND_COOLDOWN_SECONDS);
      setSuccessMsg(data.message || 'We sent a 6-digit verification code to your email address.');
      setMode('verify');
    } catch (err: any) {
      if (err?.code === 'USER_ALREADY_EXISTS') {
        setDuplicateSignupEmail(cleanEmail);
      }
      setErrorMsg(err?.message || 'Error occurred while creating account.');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  // Sign In Submission
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy || submittingRef.current) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setUnverifiedSignInEmail(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMsg('Please enter your email and password.');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      const data = await authService.login(cleanEmail, password);
      onSuccess(data.user);
      onClose();
    } catch (err: any) {
      if (err?.code === 'EMAIL_NOT_CONFIRMED') {
        setUnverifiedSignInEmail(cleanEmail);
      }
      setErrorMsg(err?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  // OTP Verification Submission
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy || submittingRef.current) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const code = otp.join('');
    if (!/^\d{6}$/.test(code)) {
      setErrorMsg('Please enter all 6 numeric digits of your verification code.');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      const data = await authService.verifyOtp(email.trim(), code);
      onSuccess(data.user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Invalid or expired 6-digit code. Please retry.');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (timerSeconds > 0 || isBusy) return;
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Email address is missing. Click Change Email to re-enter your email.');
      return;
    }

    setResending(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const data = await authService.resendOtp(cleanEmail);
      setOtp(['', '', '', '', '', '']);
      setTimerSeconds(RESEND_COOLDOWN_SECONDS);
      setSuccessMsg(data.message || 'A new 6-digit verification code has been sent to your email address.');
      otpInputRefs.current[0]?.focus();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to resend verification code. Please try again shortly.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fs-fade overflow-y-auto">
      <div className="relative bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full shadow-2xl border border-[#D5E5CA] overflow-hidden flex flex-col md:flex-row my-auto max-h-[94dvh]">
        
        {/* Close Button - Enhanced 44px touch target */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 z-20 w-11 h-11 flex items-center justify-center rounded-full bg-white/90 hover:bg-[#F0F5EE] text-[#073D2B] transition-colors shadow-xs"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Side: Brand Visual & Earth Mockup (Desktop) */}
        <div className="hidden md:flex md:w-5/12 bg-gradient-to-b from-[#073D2B] via-[#0E4935] to-[#145C3D] p-6 lg:p-8 text-white flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-[#76B93F]/20 blur-2xl" />
          
          <div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white p-0.5 overflow-hidden">
                <img
                  src="/assets/aistudio/Eco-Tech_Globe_Branding_Logo__1__5456db76.png"
                  alt="Field Shift"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="font-display text-xl font-bold">
                Field<span className="text-[#76B93F]">Shift</span>
              </span>
            </div>

            <h3 className="font-display text-2xl font-bold mt-8 leading-tight">
              {mode === 'signup'
                ? 'Join Field Shift'
                : mode === 'verify'
                ? 'Verify your email'
                : 'Welcome Back'}
            </h3>
            <p className="text-xs text-white/80 mt-2 leading-relaxed">
              {mode === 'signup'
                ? 'Be part of a smarter, greener agricultural future powered by NASA Earth observations.'
                : mode === 'verify'
                ? 'Enter the 6-digit verification code sent to your inbox to activate your FieldShift workspace.'
                : 'Sign in to continue your agricultural crop rotation and soil intelligence journey.'}
            </p>
          </div>

          <div className="my-2 relative flex items-center justify-center min-h-[240px]">
            <FieldShiftEarth
              size={mode === 'verify' ? 210 : 255}
              speed={0.8}
              showSatellite={true}
              showAtmosphere={true}
              interactive={true}
              quality="high"
              className="drop-shadow-2xl"
            />
          </div>

          <div className="space-y-2 border-t border-white/15 pt-4 text-[11px] text-white/75">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#76B93F]" />
              <span>Multi-mission NASA Satellite Ingestion</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#76B93F]" />
              <span>Soil Health & Nitrogen Fixing Calculations</span>
            </div>
          </div>
        </div>

        {/* Right Side: Form Area */}
        <div className="w-full md:w-7/12 p-4 sm:p-6 md:p-8 overflow-y-auto bg-[#F8F7ED]/50 flex flex-col justify-start md:justify-center">
          {/* Compact Mobile Header inside Modal */}
          <div className="md:hidden flex items-center gap-2.5 mb-4 pr-11">
            <div className="w-8 h-8 rounded-full bg-white p-0.5 border border-[#D5E5CA] shrink-0">
              <img
                src="/assets/aistudio/Eco-Tech_Globe_Branding_Logo__1__5456db76.png"
                alt="Field Shift"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-display text-lg font-bold text-[#073D2B]">
              Field<span className="text-[#76B93F]">Shift</span>
            </span>
          </div>

          {/* Tabs for Sign Up / Sign In */}
          {(mode === 'signin' || mode === 'signup') && (
            <div className="flex items-center bg-[#E7EFE6] p-1 rounded-full mb-5 w-full max-w-xs mx-auto">
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setUnverifiedSignInEmail(null);
                  setDuplicateSignupEmail(null);
                }}
                className={`flex-1 py-2 min-h-[40px] text-xs font-bold rounded-full transition-all ${
                  mode === 'signup'
                    ? 'bg-white text-[#073D2B] shadow-xs'
                    : 'text-[#527367] hover:text-[#073D2B]'
                }`}
              >
                Sign Up
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setUnverifiedSignInEmail(null);
                  setDuplicateSignupEmail(null);
                }}
                className={`flex-1 py-2 min-h-[40px] text-xs font-bold rounded-full transition-all ${
                  mode === 'signin'
                    ? 'bg-white text-[#073D2B] shadow-xs'
                    : 'text-[#527367] hover:text-[#073D2B]'
                }`}
              >
                Sign In
              </button>
            </div>
          )}

          {/* Status Banners */}
          {errorMsg && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-2"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>

              {unverifiedSignInEmail && mode === 'signin' && (
                <div className="flex flex-wrap items-center gap-2 pl-6">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(unverifiedSignInEmail);
                      setOtp(['', '', '', '', '', '']);
                      setTimerSeconds(0);
                      setErrorMsg(null);
                      setSuccessMsg('Enter your 6-digit code below or request a new verification code.');
                      setMode('verify');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#073D2B] text-white font-bold text-[11px] hover:bg-[#145C3D] transition-colors"
                  >
                    Enter OTP / Resend Code
                  </button>
                </div>
              )}

              {duplicateSignupEmail && mode === 'signup' && (
                <div className="flex flex-wrap items-center gap-2 pl-6">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(duplicateSignupEmail);
                      setErrorMsg(null);
                      setDuplicateSignupEmail(null);
                      setMode('signin');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#073D2B] text-white font-bold text-[11px] hover:bg-[#145C3D] transition-colors"
                  >
                    Go to Sign In
                  </button>
                </div>
              )}
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ================= MODE: SIGN UP ================= */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div className="text-center sm:text-left mb-2">
                <h3 className="font-display text-xl font-bold text-[#073D2B]">Create Your Account</h3>
                <p className="text-xs text-[#527367]">Start using Field Shift with 6-digit email verification.</p>
              </div>

              <div>
                <label htmlFor="signup-full-name" className="block text-xs font-semibold text-[#073D2B] mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3.5 w-4 h-4 text-[#8C9E94]" />
                  <input
                    id="signup-full-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ahmed Raza"
                    className="w-full pl-9 pr-3 py-2.5 min-h-[44px] rounded-xl border border-[#D5E5CA] bg-white text-sm sm:text-xs text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-email" className="block text-xs font-semibold text-[#073D2B] mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 w-4 h-4 text-[#8C9E94]" />
                  <input
                    id="signup-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ahmed@example.com"
                    className="w-full pl-9 pr-3 py-2.5 min-h-[44px] rounded-xl border border-[#D5E5CA] bg-white text-sm sm:text-xs text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="signup-password" className="block text-xs font-semibold text-[#073D2B] mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 w-4 h-4 text-[#8C9E94]" />
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full pl-9 pr-11 py-2.5 min-h-[44px] rounded-xl border border-[#D5E5CA] bg-white text-sm sm:text-xs text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#8C9E94] hover:text-[#073D2B]"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="signup-confirm-password" className="block text-xs font-semibold text-[#073D2B] mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 w-4 h-4 text-[#8C9E94]" />
                    <input
                      id="signup-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2.5 min-h-[44px] rounded-xl border border-[#D5E5CA] bg-white text-sm sm:text-xs text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded text-[#073D2B] focus:ring-[#76B93F] w-5 h-5 shrink-0"
                />
                <label htmlFor="terms" className="text-xs text-[#527367] leading-snug">
                  I agree to the <span className="underline font-semibold text-[#073D2B]">Terms of Service</span> and{' '}
                  <span className="underline font-semibold text-[#073D2B]">Privacy Policy</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isBusy}
                className="w-full py-3 min-h-[44px] rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md mt-2 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="w-4 h-4 text-[#76B93F]" />
                  </>
                )}
              </button>

              {authService.isSupabaseConfigured() && (
                <>
                  <div className="relative flex items-center justify-center my-2">
                    <div className="border-t border-[#E2E8DE] w-full" />
                    <span className="bg-[#F8F7ED] px-2.5 text-[11px] font-medium text-[#8C9E94] shrink-0">or</span>
                    <div className="border-t border-[#E2E8DE] w-full" />
                  </div>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={handleGoogleAuth}
                    className="w-full py-2.5 min-h-[44px] rounded-full bg-white hover:bg-[#F0F5EE] text-[#073D2B] border border-[#D5E5CA] text-xs font-bold flex items-center justify-center gap-2.5 transition-all shadow-2xs disabled:opacity-50"
                  >
                    {oauthLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="#4285F4"
                            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                          />
                        </svg>
                        <span>Continue with Google</span>
                      </>
                    )}
                  </button>
                </>
              )}

              <div className="text-center text-xs text-[#527367] pt-1">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setDuplicateSignupEmail(null);
                    setMode('signin');
                  }}
                  className="font-bold text-[#073D2B] hover:underline py-2 px-1"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* ================= MODE: SIGN IN ================= */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="text-center sm:text-left mb-2">
                <h3 className="font-display text-xl font-bold text-[#073D2B]">Sign In</h3>
                <p className="text-xs text-[#527367]">Access your account and farm telemetry.</p>
              </div>

              {/* Quick test credentials card */}
              <div className="p-3 rounded-xl bg-[#EAF5DF] border border-[#C2E0B0] flex flex-wrap items-center justify-between gap-2 text-xs text-[#073D2B]">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="w-4 h-4 text-[#4A8528] shrink-0" />
                  <div className="min-w-0">
                    <span className="font-semibold block text-[11px] text-[#073D2B]">Test Credentials</span>
                    <span className="text-[11px] text-[#375A47] break-all">test@test.com &bull; 12345678</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('test@test.com');
                    setPassword('12345678');
                    setErrorMsg(null);
                    setUnverifiedSignInEmail(null);
                  }}
                  className="px-3 py-2 min-h-[38px] text-[11px] font-bold rounded-lg bg-[#073D2B] text-white hover:bg-[#145C3D] transition-colors cursor-pointer shrink-0"
                >
                  Auto-fill
                </button>
              </div>

              <div>
                <label htmlFor="signin-email" className="block text-xs font-semibold text-[#073D2B] mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 w-4 h-4 text-[#8C9E94]" />
                  <input
                    id="signin-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="test@test.com"
                    className="w-full pl-9 pr-3 py-2.5 min-h-[44px] rounded-xl border border-[#D5E5CA] bg-white text-sm sm:text-xs text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="signin-password" className="text-xs font-semibold text-[#073D2B]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setMode('forgot');
                    }}
                    className="text-xs text-[#527367] hover:text-[#073D2B] underline py-1"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 w-4 h-4 text-[#8C9E94]" />
                  <input
                    id="signin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="12345678"
                    className="w-full pl-9 pr-11 py-2.5 min-h-[44px] rounded-xl border border-[#D5E5CA] bg-white text-sm sm:text-xs text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#8C9E94] hover:text-[#073D2B]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded text-[#073D2B] focus:ring-[#76B93F] w-5 h-5"
                />
                <label htmlFor="remember" className="text-xs text-[#527367]">
                  Remember me on this browser
                </label>
              </div>

              <button
                type="submit"
                disabled={isBusy}
                className="w-full py-3 min-h-[44px] rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4 text-[#76B93F]" />
                  </>
                )}
              </button>

              {authService.isSupabaseConfigured() && (
                <>
                  <div className="relative flex items-center justify-center my-2">
                    <div className="border-t border-[#E2E8DE] w-full" />
                    <span className="bg-[#F8F7ED] px-2.5 text-[11px] font-medium text-[#8C9E94] shrink-0">or</span>
                    <div className="border-t border-[#E2E8DE] w-full" />
                  </div>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={handleGoogleAuth}
                    className="w-full py-2.5 min-h-[44px] rounded-full bg-white hover:bg-[#F0F5EE] text-[#073D2B] border border-[#D5E5CA] text-xs font-bold flex items-center justify-center gap-2.5 transition-all shadow-2xs disabled:opacity-50"
                  >
                    {oauthLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="#4285F4"
                            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                          />
                        </svg>
                        <span>Continue with Google</span>
                      </>
                    )}
                  </button>
                </>
              )}

              <div className="text-center text-xs text-[#527367] pt-1">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setUnverifiedSignInEmail(null);
                    setMode('signup');
                  }}
                  className="font-bold text-[#073D2B] hover:underline py-2 px-1"
                >
                  Sign Up
                </button>
              </div>
            </form>
          )}

          {/* ================= MODE: 6-DIGIT EMAIL VERIFICATION ================= */}
          {mode === 'verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5 text-center">
              {/* Mobile 3D Earth orbital element */}
              <div className="md:hidden flex justify-center -my-1">
                <FieldShiftEarth
                  size={112}
                  speed={0.7}
                  showSatellite={true}
                  showAtmosphere={true}
                  interactive={false}
                  quality="low"
                  className="mx-auto"
                />
              </div>

              <div className="w-14 h-14 rounded-2xl bg-[#EAF5DF] text-[#145C3D] items-center justify-center mx-auto shadow-xs hidden md:flex">
                <Mail className="w-7 h-7 text-[#145C3D]" />
              </div>

              <div>
                <h3 className="font-display text-xl font-bold text-[#073D2B]">Verify your email</h3>
                <p className="text-xs text-[#527367] mt-1 leading-relaxed">
                  We sent a 6-digit verification code to your email address.
                  {email.trim() && (
                    <>
                      <br />
                      <strong className="text-[#073D2B] break-all">{email.trim()}</strong>
                    </>
                  )}
                </p>
              </div>

              {/* 6 Individual OTP Boxes - Numeric, paste-friendly & keyboard accessible */}
              <div
                className="flex items-center justify-center gap-1.5 sm:gap-2.5 max-w-full px-1"
                onPaste={handlePasteOtp}
                role="group"
                aria-label="6-digit verification code"
              >
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      otpInputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    aria-label={`Verification digit ${index + 1}`}
                    disabled={loading}
                    className="w-10 h-12 sm:w-11 sm:h-13 md:w-12 md:h-14 text-center font-display text-base sm:text-lg font-bold rounded-lg sm:rounded-xl border border-[#D5E5CA] bg-white text-[#073D2B] shadow-xs focus:outline-hidden focus:ring-2 focus:ring-[#76B93F] focus:border-[#76B93F] disabled:opacity-60"
                  />
                ))}
              </div>

              {/* Countdown / Resend Action */}
              <div className="text-xs text-[#527367]">
                Didn't receive the code?{' '}
                {timerSeconds > 0 ? (
                  <span className="font-semibold text-[#073D2B]" aria-live="polite">
                    Resend in 00:{timerSeconds < 10 ? `0${timerSeconds}` : timerSeconds}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={handleResendOtp}
                    className="font-bold text-[#145C3D] hover:underline py-2 px-1 disabled:opacity-50"
                  >
                    {resending ? 'Sending...' : 'Resend Code'}
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isBusy || otp.join('').length < 6}
                className="w-full py-3 min-h-[44px] rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Verify Email</span>
                    <ArrowRight className="w-4 h-4 text-[#76B93F]" />
                  </>
                )}
              </button>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-1">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setOtp(['', '', '', '', '', '']);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setMode('signup');
                  }}
                  className="text-xs font-semibold text-[#145C3D] hover:text-[#073D2B] hover:underline py-2 px-2 min-h-[44px]"
                >
                  Change Email
                </button>
                <span className="text-[#D5E5CA]" aria-hidden="true">|</span>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setOtp(['', '', '', '', '', '']);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setMode('signin');
                  }}
                  className="text-xs text-[#527367] hover:text-[#073D2B] underline py-2 px-2 min-h-[44px]"
                >
                  Back to Login
                </button>
              </div>
            </form>
          )}

          {/* ================= MODE: FORGOT PASSWORD ================= */}
          {mode === 'forgot' && (
            <div className="space-y-4">
              <div className="text-center sm:text-left mb-2">
                <h3 className="font-display text-xl font-bold text-[#073D2B]">Reset Password</h3>
                <p className="text-xs text-[#527367]">Enter your email to receive recovery instructions.</p>
              </div>

              <div>
                <label htmlFor="forgot-email" className="block text-xs font-semibold text-[#073D2B] mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 w-4 h-4 text-[#8C9E94]" />
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ahmed@example.com"
                    className="w-full pl-9 pr-3 py-2.5 min-h-[44px] rounded-xl border border-[#D5E5CA] bg-white text-sm sm:text-xs text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F]"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={isBusy || !email.trim()}
                onClick={async () => {
                  if (!email.trim()) {
                    setErrorMsg('Please enter your email address first.');
                    return;
                  }
                  setLoading(true);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  try {
                    const res = await authService.forgotPassword(email.trim());
                    setSuccessMsg(res.message || 'Reset link dispatched to your inbox.');
                    setTimeout(() => setMode('signin'), 2000);
                  } catch (err: any) {
                    setErrorMsg(err?.message || 'Unable to send reset instructions.');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="w-full py-3 min-h-[44px] rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-sm font-bold transition-all shadow-md disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : 'Send Reset Link'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setMode('signin');
                  }}
                  className="text-xs text-[#527367] hover:text-[#073D2B] underline py-2 px-3 min-h-[44px]"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
