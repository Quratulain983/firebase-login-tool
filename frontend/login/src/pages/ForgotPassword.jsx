import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock } from "lucide-react";
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import axios from "axios";
import { auth } from "../firebase";

export default function ForgotPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = params.get("oobCode");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("verifying"); 
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Check the link is valid before showing the form
  useEffect(() => {
    if (!oobCode) return setStatus("invalid");
    verifyPasswordResetCode(auth, oobCode)
      .then((mail) => { setEmail(mail); setStatus("ready"); })
      .catch(() => setStatus("invalid"));
  }, [oobCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setLoading(true);
    try {
      // 1. Set the new password in Firebase
      await confirmPasswordReset(auth, oobCode, password);

      // 2. Sign in with it to get a token, then sync to Django
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      await axios.post(
        "http://127.0.0.1:8000/api/sync-password/",
        { access_token: idToken, new_password: password },
        { timeout: 10000 }
      );

      await signOut(auth);
      setStatus("done");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      console.error(err);
      setError("Could not reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full border border-[#E4E0D6] rounded-sm pl-10 pr-3 py-2.5 text-[15px] focus:outline-none focus:border-[#C98A3E]";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBF9F5] px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-[26px] text-[#1F2229] mb-6" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
          Set a new password
        </h1>

        {status === "verifying" && <p className="text-sm text-[#8A8F98]">Checking your link...</p>}

        {status === "invalid" && (
          <div>
            <p className="text-sm text-red-600 mb-4">This reset link is invalid or has expired.</p>
            <button onClick={() => navigate("/login")} className="text-sm underline">
              Back to sign in
            </button>
          </div>
        )}

        {status === "done" && (
          <p className="text-sm text-[#3E7C74]">Password updated! Redirecting to sign in...</p>
        )}

        {status === "ready" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-[#8A8F98]">Resetting password for <b>{email}</b></p>

            {[["New password", password, setPassword], ["Confirm password", confirm, setConfirm]].map(
              ([label, val, set]) => (
                <div key={label} className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B8BCC4]" />
                  <input
                    type="password"
                    required
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    placeholder={label}
                    className={inputClass}
                  />
                </div>
              )
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1F2229] text-[#FBF9F5] rounded-sm py-3 text-[15px] disabled:opacity-60"
            >
              {loading ? "Updating..." : "Update password"}
            </button>
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}