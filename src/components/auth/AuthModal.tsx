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
  const [timerSeconds, setTimerSeconds] = useState(45);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setMode(initialMode);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [initialMode, isOpen]);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (mode !== 'verify' || timerSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [mode, timerSeconds]);

  if (!isOpen) return null;

  // Handle OTP digit changes with auto-focus next
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handlePasteOtp = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim().slice(0, 6);
    if (/^\d+$/.test(pasted)) {
      const digits = pasted.split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (i < 6) newOtp[i] = d;
      });
      setOtp(newOtp);
      otpInputRefs.current[Math.min(digits.length, 5)]?.focus();
    }
  };

  // Sign Up Submission
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || !email.trim() || !password) {
      setErrorMsg('Please complete all required fields.');
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

    setLoading(true);
    try {
      const data = await authService.register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      });

      setDevOtpHint(data.devOtpCode || null);
      setSuccessMsg('Verification code sent to your email.');
      setMode('verify');
      setTimerSeconds(45);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while creating account.');
    } finally {
      setLoading(false);
    }
  };

  // Sign In Submission
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMsg('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const data = await authService.login(cleanEmail, password);
      onSuccess(data.user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  // OTP Verification Submission
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const code = otp.join('');

    if (code.length < 6) {
      setErrorMsg('Please enter all 6 digits of the verification code.');
      return;
    }

    setLoading(true);
    try {
      const data = await authService.verifyOtp(email.trim(), code);
      onSuccess(data.user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid 6-digit code. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (timerSeconds > 0) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await authService.resendOtp(email.trim());
      setTimerSeconds(45);
      setDevOtpHint(data.devOtpCode || null);
      setSuccessMsg('A fresh verification code was sent.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full shadow-2xl border border-[#D5E5CA] overflow-hidden flex flex-col md:flex-row my-auto max-h-[96vh] md:max-h-[92vh]">
        
        {/* Close Button - Enhanced 44px touch target */}
        <button
          onClick={onClose}
          className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 z-20 w-11 h-11 flex items-center justify-center rounded-full bg-white/90 hover:bg-[#F0F5EE] text-[#073D2B] transition-colors shadow-xs"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Side: Brand Visual & Earth Mockup (Desktop) */}
        <div className="hidden md:flex md:w-5/12 bg-gradient-to-b from-[#073D2B] via-[#0E4935] to-[#145C3D] p-6 lg:p-8 text-white flex-col justify-between relative overflow-hidden">
          {/* Subtle decorative glow */}
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
                ? 'Verify Your Email'
                : 'Welcome Back'}
            </h3>
            <p className="text-xs text-white/80 mt-2 leading-relaxed">
              {mode === 'signup'
                ? 'Be part of a smarter, greener agricultural future powered by NASA Earth observations.'
                : mode === 'verify'
                ? 'Enter the 6-digit code sent to your registered address to activate your account.'
                : 'Sign in to continue your agricultural crop rotation and soil intelligence journey.'}
            </p>
          </div>

          {/* Interactive 3D Field Shift Liquid Earth Visualization */}
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
        <div className="w-full md:w-7/12 p-4 sm:p-6 md:p-8 overflow-y-auto bg-[#F8F7ED]/50 flex flex-col justify-center">
          
          {/* Tabs for Sign Up / Sign In (Only in signin/signup modes) */}
          {(mode === 'signin' || mode === 'signup') && (
            <div className="flex items-center bg-[#E7EFE6] p-1 rounded-full mb-6 max-w-xs mx-auto">
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all ${
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
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all ${
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
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Dev OTP Helper Banner for smooth evaluation */}
          {devOtpHint && mode === 'verify' && (
            <div className="mb-4 p-2.5 rounded-xl bg-lime-50 border border-lime-300 text-[11px] text-lime-900 flex items-center justify-between">
              <span><strong>Testing OTP Code:</strong> {devOtpHint}</span>
              <button
                type="button"
                onClick={() => {
                  const digits = devOtpHint.split('');
                  setOtp(digits);
                }}
                className="text-xs font-bold text-[#073D2B] underline"
              >
                Auto-fill
              </button>
            </div>
          )}

          {/* ================= MODE: SIGN UP ================= */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div className="text-center sm:text-left mb-2">
                <h3 className="font-display text-xl font-bold text-[#073D2B]">Create Your Account</h3>
                <p className="text-xs text-[#527367]">Start using Field Shift for free.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#073D2B] mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 w-4 h-4 text-[#8C9E94]" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ahmed Raza"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#073D2B] mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-[#8C9E94]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ahmed@example.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#073D2B] mb-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-[#8C9E94]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-3 text-[#8C9E94]"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#073D2B] mb-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-[#8C9E94]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="rounded text-[#073D2B] focus:ring-[#76B93F] w-4 h-4"
                />
                <label htmlFor="terms" className="text-[11px] text-[#527367]">
                  I agree to the <span className="underline font-semibold text-[#073D2B]">Terms of Service</span> and{' '}
                  <span className="underline font-semibold text-[#073D2B]">Privacy Policy</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md mt-2 disabled:opacity-50"
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

              <div className="text-center text-[11px] text-[#527367] pt-2">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="font-bold text-[#073D2B] hover:underline"
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
              <div className="p-2.5 rounded-xl bg-[#EAF5DF] border border-[#C2E0B0] flex items-center justify-between text-xs text-[#073D2B]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#4A8528] shrink-0" />
                  <div>
                    <span className="font-semibold block text-[11px] text-[#073D2B]">Test Credentials</span>
                    <span className="text-[11px] text-[#375A47]">test@test.com &bull; 12345678</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('test@test.com');
                    setPassword('12345678');
                    setErrorMsg(null);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#073D2B] text-white hover:bg-[#145C3D] transition-colors cursor-pointer"
                >
                  Auto-fill
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#073D2B] mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-[#8C9E94]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="test@test.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#073D2B]">Password</label>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-[11px] text-[#527367] hover:text-[#073D2B] underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-[#8C9E94]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="12345678"
                    className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-3 text-[#8C9E94]"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded text-[#073D2B] focus:ring-[#76B93F] w-4 h-4"
                />
                <label htmlFor="remember" className="text-[11px] text-[#527367]">
                  Remember me on this browser
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
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

              <div className="text-center text-[11px] text-[#527367] pt-2">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="font-bold text-[#073D2B] hover:underline"
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
              <div className="md:hidden flex justify-center -my-2">
                <FieldShiftEarth
                  size={120}
                  speed={0.7}
                  showSatellite={true}
                  showAtmosphere={true}
                  interactive={false}
                  quality="medium"
                  className="mx-auto"
                />
              </div>

              <div className="w-14 h-14 rounded-2xl bg-[#EAF5DF] text-[#145C3D] flex items-center justify-center mx-auto shadow-xs hidden md:flex">
                <Mail className="w-7 h-7 text-[#145C3D]" />
              </div>

              <div>
                <h3 className="font-display text-xl font-bold text-[#073D2B]">Verify Your Email</h3>
                <p className="text-xs text-[#527367] mt-1">
                  We've sent a 6-digit verification code to: <br />
                  <strong className="text-[#073D2B]">
                    {email ? (email.length > 5 ? `${email.slice(0, 3)}***@${email.split('@')[1] || 'domain.com'}` : email) : 'ahmed@example.com'}
                  </strong>
                </p>
              </div>

              {/* 6 Individual OTP Boxes - Scales perfectly down to 320px screens */}
              <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 max-w-full overflow-hidden px-1" onPaste={handlePasteOtp}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      otpInputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-8.5 h-11 sm:w-11 sm:h-13 md:w-12 md:h-14 text-center font-display text-base sm:text-lg font-bold rounded-lg sm:rounded-xl border border-[#D5E5CA] bg-white text-[#073D2B] shadow-xs focus:outline-hidden focus:ring-2 focus:ring-[#76B93F] focus:border-[#76B93F]"
                  />
                ))}
              </div>

              {/* Countdown / Resend Action */}
              <div className="text-xs text-[#527367]">
                Didn't receive the code?{' '}
                {timerSeconds > 0 ? (
                  <span className="font-semibold text-[#073D2B]">
                    Resend in 00:{timerSeconds < 10 ? `0${timerSeconds}` : timerSeconds}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="font-bold text-[#145C3D] hover:underline"
                  >
                    Resend Code Now
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || otp.join('').length < 6}
                className="w-full py-3 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Verify Account</span>
                    <ArrowRight className="w-4 h-4 text-[#76B93F]" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-xs text-[#527367] hover:text-[#073D2B] underline"
              >
                Back to Sign In
              </button>
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
                <label className="block text-xs font-semibold text-[#073D2B] mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-[#8C9E94]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ahmed@example.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F]"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={loading || !email.trim()}
                onClick={async () => {
                  if (!email.trim()) {
                    setErrorMsg('Please enter your email address first.');
                    return;
                  }
                  setLoading(true);
                  setErrorMsg(null);
                  try {
                    const res = await authService.forgotPassword(email.trim());
                    setSuccessMsg(res.message || 'Reset link dispatched to your inbox.');
                    setTimeout(() => setMode('signin'), 2000);
                  } catch (err: any) {
                    setErrorMsg(err.message || 'Unable to send reset instructions.');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="w-full py-3 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : 'Send Reset Link'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="text-xs text-[#527367] hover:text-[#073D2B] underline"
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
