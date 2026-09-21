import React, { useState } from "react";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  signInWithPopup,
  GoogleAuthProvider,
  getAdditionalUserInfo,
  deleteUser,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase";
import axios from "axios";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("signin");
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await axios.post(
        "http://127.0.0.1:8000/api/forgot-password/",
        { email: form.email },
        { timeout: 10000 }
      );
      setResetSent(true);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to send reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isSignup = mode === "signup";

  const handleChange = (field) => (e) => {
    setForm((f) => ({
      ...f,
      [field]: e.target.value,
    }));
  };



  // login with django
  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSubmitted(false);

    try {
      // ///////////////////////////////////////////////
      //Sign up
     if (isSignup) {
  setError("");

  // Step 1: create the Firebase account
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
  } catch (err) {
    console.error("Firebase signup error:", err);
    // Nothing was created, so there is nothing to roll back
    if (err.code === "auth/email-already-in-use") {
      setError("An account with this email already exists.");
    } else if (err.code === "auth/weak-password") {
      setError("Password is too weak.");
    } else {
      setError("Signup failed. Please try again.");
    }
    return;
  }

  // Step 2: profile update + Django sync (roll back Firebase on any failure)
  try {
    await updateProfile(cred.user, { displayName: form.username });
    const idToken = await cred.user.getIdToken(true);

    const response = await axios.post(
      "http://127.0.0.1:8000/api/firebase-login/",
      { access_token: idToken, name: form.username, password: form.password },
      { headers: { "Content-Type": "application/json" }, timeout: 10000 }
    );

    localStorage.setItem("user", JSON.stringify(response.data.user));
    localStorage.setItem("loggedInAt", response.data.logged_in_at);

    setSubmitted(true);
    setTimeout(() => navigate("/login"), 1000);
  } catch (err) {
    console.error("Signup sync failed:", err.response?.data || err);

    try {
      await deleteUser(cred.user);
    } catch (cleanupErr) {
      console.error("Firebase cleanup failed:", cleanupErr);
      await signOut(auth).catch(() => { });
    }

    setError(
      err.response?.data?.error ||
      (err.response
        ? "Server error. Please try again."
        : "Unable to connect to server. Please try again later.")
    );
  }
}
      // ///////////////////////////////////////////////
      //login in
      else {

        console.log("Email being sent:", JSON.stringify(form.email));

        const userCredential = await signInWithEmailAndPassword(auth, form.email, form.password);

        const idToken = await userCredential.user.getIdToken();

        console.log("Firebase ID Token:", idToken);


        const response = await axios.post(
          "http://127.0.0.1:8000/api/firebase-login/",
          { access_token: idToken },
          { headers: { "Content-Type": "application/json" }, timeout: 10000 }
        );

        if (response.data.email_sent === false) {
          console.warn("Login succeeded but welcome email failed to send.");
        }

        localStorage.setItem("user", JSON.stringify(response.data.user));
        localStorage.setItem("loggedInAt", response.data.logged_in_at);

        setSubmitted(true);

        setTimeout(() => {
          navigate("/dashboard");
        }, 1000);

        return response.data;



        // const response = await fetch("http://127.0.0.1:8000/api/login/", {
        //   method: "POST",
        //   headers: {
        //     "Content-Type": "application/json",
        //   },
        //   body: JSON.stringify({
        //     email: form.email,
        //     password: form.password,
        //   }),
        // });

        // const data = await response.json();

        // if (!response.ok) {
        //   setError(data.message || "Signin failed");
        //   return;
        // }

        // setSubmitted(true);

        // localStorage.setItem("user", JSON.stringify(data.user));
        // localStorage.setItem("access", data.access);
        // localStorage.setItem("refresh", data.refresh);
        // localStorage.setItem("loggedInAt", data.logged_in_at);

        // setTimeout(() => {
        //   window.location.href = "/dashboard";
        // }, 1000);




      }
    } catch (err) {
      console.error("API Error:", err);

      setError(
        err.code === "auth/email-already-in-use"
          ? "This email is already registered. Try signing in."
          : err.code === "auth/weak-password"
            ? "Password must be at least 6 characters."
            : err.response?.data?.error || "Something went wrong. Please try again."
      );
    }
  };

  const handleGoogleLogin = async () => {
    setError("");

    // Step 1: Google sign-in through Firebase
    let result;
    try {
      const provider = new GoogleAuthProvider();
      result = await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Google popup error:", err);
      setError("Google sign-in failed. Please try again.");
      return;
    }

    const firebaseUser = result.user;
    // true only if this Google sign-in just CREATED the Firebase account
    const isNewFirebaseUser = getAdditionalUserInfo(result)?.isNewUser === true;

    // Step 2: sync with Django
    try {
      const firebaseAccessToken = await firebaseUser.getIdToken(true);

      const response = await axios.post(
        "http://127.0.0.1:8000/api/firebase-login/",
        { access_token: firebaseAccessToken },
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.email_sent === false) {
        console.warn("Login succeeded but welcome email failed to send.");
      }

      localStorage.setItem("user", JSON.stringify(response.data.user));
      localStorage.setItem("loggedInAt", response.data.logged_in_at);
      navigate("/dashboard");
      return response.data;
    } catch (err) {
      console.error("Django sync failed:", err.response?.data || err);

      // Roll back: remove the Firebase account only if we just created it
      try {
        if (isNewFirebaseUser) {
          await deleteUser(firebaseUser);
        } else {
          await signOut(auth);
        }
      } catch (cleanupErr) {
        console.error("Firebase cleanup failed:", cleanupErr);
        await signOut(auth).catch(() => { });
      }

      setError(
        err.response?.data?.error ||
        (err.response
          ? "Server error. Please try again."
          : "Unable to connect to server. Please try again later.")
      );
    }
  };

  if (mode === "forgot") {
    return (
      <div className="min-h-screen w-full flex bg-[#FBF9F5]">
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-sm">
            <h1
              className="text-[26px] text-[#1F2229] mb-1"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
            >
              Forgot password?
            </h1>
            <p className="text-[#8A8F98] text-sm mb-8">
              Enter your email and we'll send you a link to reset your password.
            </p>

            {resetSent ? (
              <p className="text-sm text-[#3E7C74]">
                If an account exists for <b>{form.email}</b>, a reset link has been
                sent. Check your inbox (and spam folder).
              </p>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <Field label="Email" icon={Mail}>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={handleChange("email")}
                    placeholder="Enter your email"
                    className={inputClass}
                  />
                </Field>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#1F2229] text-[#FBF9F5] rounded-sm py-3 text-[15px] flex items-center justify-center gap-2 hover:bg-[#14161B] transition-colors disabled:opacity-60"
                >
                  {loading ? "Sending..." : <>Send reset link <ArrowRight size={16} /></>}
                </button>
              </form>
            )}

            {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}

            <button
              type="button"
              onClick={() => { setMode("signin"); setError(""); setResetSent(false); }}
              className="mt-8 text-[13px] text-[#9A9EA5] hover:text-[#C98A3E] underline underline-offset-2"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }







  return (
    <div className="min-h-screen w-full flex bg-[#FBF9F5]">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">

          <div className="flex items-center gap-2 mb-10">
            <div className="w-7 h-7 rounded-sm bg-[#C98A3E] flex items-center justify-center">
              <span className="font-serif text-[#14161B] text-xs font-bold">
                V
              </span>
            </div>

            <span className="text-sm tracking-wide text-[#6B7078]">
              VMS Mexemai
            </span>
          </div>

          <div className="flex items-center gap-6 border-b border-[#E4E0D6] mb-9">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError("");
                setSubmitted(false);
              }}
              className={`relative pb-3 text-[15px] transition-colors ${!isSignup
                ? "text-[#1F2229]"
                : "text-[#9A9EA5] hover:text-[#4A4E56]"
                }`}
            >
              Sign in

              {!isSignup && (
                <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#C98A3E] rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError("");
                setSubmitted(false);
              }}
              className={`relative pb-3 text-[15px] transition-colors ${isSignup
                ? "text-[#1F2229]"
                : "text-[#9A9EA5] hover:text-[#4A4E56]"
                }`}
            >
              Create account

              {isSignup && (
                <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#C98A3E] rounded-full" />
              )}
            </button>
          </div>

          <h1
            className="text-[26px] text-[#1F2229] mb-1"
            style={{
              fontFamily: "'Source Serif 4', Georgia, serif",
            }}
          >
            {isSignup ? "Start your new account" : "Welcome back"}
          </h1>

          <p className="text-[#8A8F98] text-sm mb-8">
            {isSignup
              ? "Create your account in under a minute."
              : "Enter your username and password to continue."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="email" icon={User}>
              <input
                type="email"
                required
                value={form.email}
                onChange={handleChange("email")}
                placeholder="Enter email"
                className={inputClass}
              />
            </Field>

            {isSignup && (


              <Field label="Username" icon={User}>
                <input
                  type="text"
                  required
                  value={form.username}
                  onChange={handleChange("username")}
                  placeholder="Enter username"
                  className={inputClass}
                />
              </Field>
            )}

            <Field label="Password" icon={Lock}>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={form.password}
                onChange={handleChange("password")}
                placeholder="Enter password"
                className={inputClass}
              />

              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A9EA5] hover:text-[#4A4E56]"
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </Field>

            {!isSignup && (
              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError("");
                    setSubmitted(false);
                    setResetSent(false);
                  }}
                  className="text-[13px] text-[#8A8F98] hover:text-[#3E7C74] transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={submitted}
              className="w-full mt-2 bg-[#1F2229] text-[#FBF9F5] rounded-sm py-3 text-[15px] flex items-center justify-center gap-2 hover:bg-[#14161B] transition-colors disabled:opacity-60"
            >
              {submitted ? (
                "Please wait..."
              ) : (
                <>
                  {isSignup ? "Create account" : "Sign in"}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {error && (
            <p className="mt-4 text-sm text-red-600 text-center">
              {error}
            </p>
          )}

          {/* Google Login Button */}
          <div className="relative flex items-center my-6">
            <div className="flex-1 border-t border-[#E4E0D6]" />

            <span className="px-4 text-[12px] text-[#9A9EA5]">
              OR
            </span>

            <div className="flex-1 border-t border-[#E4E0D6]" />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 border border-[#E4E0D6] bg-white rounded-sm py-3 text-[14px] text-[#1F2229] hover:bg-[#F7F5F0] transition-colors"
          >
            {/* Google Logo */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M21.805 12.23c0-.79-.07-1.55-.23-2.28H12v4.32h5.5a4.7 4.7 0 0 1-2.04 3.08v2.56h3.3c1.93-1.78 3.045-4.4 3.045-7.68Z"
                fill="#4285F4"
              />

              <path
                d="M12 22c2.76 0 5.08-.91 6.77-2.47l-3.3-2.56c-.91.61-2.07.97-3.47.97-2.67 0-4.94-1.8-5.75-4.22H2.84v2.64A10.22 10.22 0 0 0 12 22Z"
                fill="#34A853"
              />

              <path
                d="M6.25 13.72A6.14 6.14 0 0 1 5.93 12c0-.6.11-1.18.32-1.72V7.64H2.84A10.1 10.1 0 0 0 1.75 12c0 1.57.38 3.05 1.09 4.36l3.41-2.64Z"
                fill="#FBBC05"
              />

              <path
                d="M12 6.06c1.5 0 2.84.52 3.9 1.54l2.93-2.93C17.08 3.06 14.76 2 12 2a10.22 10.22 0 0 0-9.16 5.64l3.41 2.64C7.06 7.86 9.33 6.06 12 6.06Z"
                fill="#EA4335"
              />
            </svg>

            <span>Continue with Google</span>
          </button>

          {submitted && (
            <p className="mt-4 text-sm text-[#3E7C74] text-center">
              {isSignup
                ? "Account created successfully!"
                : "Signed in successfully!"}
            </p>
          )}

          <p className="mt-8 text-center text-[13px] text-[#9A9EA5]">
            {isSignup
              ? "Already have an account?"
              : "New to VMS Mexemai?"}{" "}

            <button
              type="button"
              onClick={() => {
                setMode(isSignup ? "signin" : "signup");
                setError("");
                setSubmitted(false);
              }}
              className="text-[#1F2229] hover:text-[#C98A3E] transition-colors underline underline-offset-2"
            >
              {isSignup ? "Sign in" : "Create one"}
            </button>

          </p>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full bg-transparent border border-[#E4E0D6] rounded-sm pl-10 pr-10 py-2.5 text-[15px] text-[#1F2229] placeholder:text-[#B8BCC4] focus:outline-none focus:border-[#C98A3E] transition-colors";

function Field({ label, icon: Icon, children }) {
  return (
    <label className="block">
      <span className="block text-[12px] text-[#8A8F98] mb-1.5">
        {label}
      </span>

      <div className="relative">
        <Icon
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B8BCC4]"
        />

        {children}
      </div>
    </label>
  );
}