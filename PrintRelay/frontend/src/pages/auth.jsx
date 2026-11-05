import { useEffect, useState } from 'react';
import { Eye, EyeOff, ArrowLeft, ArrowRight, Check, Printer, Sparkles } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage, payload } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button, Field, Loader, Logo } from '../components/common';
import { useToast } from '../context/ToastContext';
import '../styles/auth.css';

const home = (role) => role === 'admin' ? '/admin/dashboard' : role === 'shop_owner' ? '/shop/dashboard' : '/customer/dashboard';

export function AuthPage() {
  const { mode } = useParams();
  const location = useLocation();
  const register = location.pathname.startsWith('/register');
  const navigate = useNavigate();
  const toast = useToast();
  const { user, ready, acceptSession } = useAuth();
  const [role, setRole] = useState(mode === 'shop-owner' ? 'shop_owner' : 'customer');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [demoDetailsOpen, setDemoDetailsOpen] = useState(false);
  const [error, setError] = useState(location.state?.message || '');
  useEffect(() => { setRole(mode === 'shop-owner' ? 'shop_owner' : 'customer'); }, [mode]);

  if (!ready) return <div className="full-loader"><Loader label="Checking your session" /></div>;
  if (user) return <Navigate to={home(user.role)} replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    const password = form.password;
    if (register && (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))) {
      setError('Use at least 8 characters, including a letter and a number.'); return;
    }
    if (register && role === 'shop_owner' && form.pincode && !/^\d{6}$/.test(form.pincode)) {
      setError('Enter a valid six-digit shop pincode.'); return;
    }
    setSubmitting(true);
    try {
      const body = register && role === 'shop_owner' ? {
        name: form.name, email: form.email, password, phone: form.phone,
        shop: { name: form.shopName, phone: form.shopPhone || form.phone, address: { line: form.line, locality: form.locality, city: form.city, ...(form.pincode ? { pincode: form.pincode } : {}) } },
      } : register ? { name: form.name, email: form.email, password, phone: form.phone || undefined } : { email: form.email, password };
      const endpoint = register ? `/auth/register/${role === 'shop_owner' ? 'shop-owner' : 'customer'}` : '/auth/login';
      const result = payload(await api.post(endpoint, body));
      if (!result?.user?.role) throw new Error('The server returned an invalid sign-in response. Please try again.');
      acceptSession(result);
      toast(register && role === 'shop_owner' ? 'Shop registration submitted for approval.' : register ? 'Your account is ready.' : 'Welcome back.');
      navigate(home(result.user.role), { replace: true });
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally { setSubmitting(false); }
  };

  return <div className="auth-page"><aside className="auth-visual"><Logo light /><div className="auth-promo"><span className="eyebrow">PRINTRELAY / YOUR WORKSPACE</span><h1>{register ? 'A smoother print run starts here.' : 'Good to have you back.'}</h1><p>{register ? 'One account for a clearer way to upload, print and collect.' : 'Pick up where you left off. Your orders and updates are right here.'}</p><div className="auth-promo-mark"><Printer size={29} strokeWidth={1.4} /><span>UPLOAD. PRINT. COLLECT.</span></div></div><span className="auth-side-footer">LOCAL PRINTING, BETTER CONNECTED.</span></aside>
    <main className="auth-main"><div className="auth-topline"><Link to="/" className="back-link"><ArrowLeft size={15} /> Home</Link><span>{register ? 'Already have an account?' : 'New to PrintRelay?'} <Link to={register ? '/login' : '/register/customer'}>{register ? 'Sign in' : 'Create account'}</Link></span></div>
      <section className="auth-form-wrap"><div className="auth-title"><span className="eyebrow">{register ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</span><h2>{register ? 'Get started.' : 'Sign in.'}</h2><p>{register ? 'Tell us a little about yourself.' : 'Your PrintRelay workspace is waiting.'}</p></div>
        {!register && <div className="demo-details">
          <button
            aria-controls="demo-details-panel"
            aria-expanded={demoDetailsOpen}
            className="demo-details-trigger"
            onClick={() => setDemoDetailsOpen((open) => !open)}
            type="button"
          >
            <Sparkles aria-hidden="true" size={17} />
            <span>{demoDetailsOpen ? 'Hide demo details' : 'Click here for demo details'}</span>
            <ArrowRight aria-hidden="true" className="demo-details-arrow" size={16} />
          </button>
          {demoDetailsOpen && <div className="demo-details-panel" id="demo-details-panel">
            <p className="demo-details-intro">Explore PrintRelay with one of these demo roles:</p>
            <ul>
              <li><span>Admin</span><div className="demo-account-credentials"><code>admin@printrelay.test</code><code>Password: PrintRelayAdmin@2026!</code></div></li>
              <li><span>Customer</span><div className="demo-account-credentials"><code>customer@printrelay.test</code><code>Password: PrintRelayCustomer@2026!</code></div></li>
              <li><span>Shop owner</span><div className="demo-account-credentials"><code>owner@printrelay.test</code><code>Password: PrintRelayOwner@2026!</code></div></li>
            </ul>
            <p className="demo-details-note">These are shared demo credentials. Please don’t enter personal or sensitive information.</p>
          </div>}
        </div>}
        {register && <div className="role-choice" role="group" aria-label="Account type"><button className={role === 'customer' ? 'selected' : ''} onClick={() => setRole('customer')} type="button"><span className="role-dot" /> Customer</button><button className={role === 'shop_owner' ? 'selected' : ''} onClick={() => setRole('shop_owner')} type="button"><span className="role-dot" /> Printing shop</button></div>}
        <form className="auth-form" onSubmit={submit}>
          {register && <Field label="Your name" name="name" placeholder="e.g. Alex Morgan" autoComplete="name" required minLength={2} maxLength={80} />}
          <Field label="Email address" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
          {register && <Field label="Phone number" name="phone" type="tel" placeholder="+91 98765 43210" autoComplete="tel" required={role === 'shop_owner'} />}
          {register && role === 'shop_owner' && <fieldset className="shop-register-fields"><legend>SHOP DETAILS</legend>
            <Field label="Shop name" name="shopName" placeholder="Your print shop" required minLength={2} maxLength={100} />
            <Field label="Street address" name="line" placeholder="Door number and street" required minLength={3} />
            <div className="form-grid-two"><Field label="Locality" name="locality" placeholder="Neighbourhood" required minLength={2} /><Field label="City" name="city" placeholder="City" required minLength={2} /></div>
            <Field label="Pincode (optional)" name="pincode" placeholder="6-digit pincode" inputMode="numeric" pattern="[0-9]{6}" />
            <Field label="Shop contact (optional)" name="shopPhone" type="tel" placeholder="Uses your phone if blank" />
          </fieldset>}
          <label className="field"><span className="field-label">Password</span><span className="password-wrap"><input name="password" type={passwordVisible ? 'text' : 'password'} placeholder={register ? 'At least 8 characters' : 'Your password'} autoComplete={register ? 'new-password' : 'current-password'} required maxLength={72} /><button type="button" className="password-toggle" aria-label={passwordVisible ? 'Hide password' : 'Show password'} onClick={() => setPasswordVisible((v) => !v)}>{passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>{register && <span className="field-hint">Use at least 8 characters with a letter and a number.</span>}</label>
          {error && <div className="form-error" role="alert">{error}</div>}
          {register && role === 'shop_owner' && <div className="approval-note"><Check size={15} /><span>New shops are reviewed by PrintRelay before they appear to customers.</span></div>}
          <Button className="auth-submit" loading={submitting} type="submit">{register ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></Button>
        </form>
        <p className="auth-terms">By continuing, you agree to use PrintRelay for legitimate document printing and follow each shop’s collection instructions.</p>
      </section>
    </main>
  </div>;
}
