import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
    verifyPasswordResetCode,
    confirmPasswordReset,
} from "firebase/auth";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import axios from "axios";
import { API_URLS } from "../urls";

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const oobCode = searchParams.get("oobCode");
    const mode = searchParams.get("mode");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [status, setStatus] = useState("checking");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (mode !== "resetPassword" || !oobCode) {
            setStatus("invalid");
            return;
        }

        verifyPasswordResetCode(auth, oobCode)
            .then((userEmail) => {
                setEmail(userEmail);
                setStatus("ready");
            })
            .catch((err) => {
                console.error("Invalid or expired reset code:", err);
                setStatus("invalid");
            });
    }, [mode, oobCode]);





const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");

  if (password.length < 6) {
    setError("Password must be at least 6 characters.");
    return;
  }
  if (password !== confirmPassword) {
    setError("Passwords do not match.");
    return;
  }

  setSubmitting(true);

  // Step 1: reset the password in Firebase
  try {
    await confirmPasswordReset(auth, oobCode, password);
  } catch (err) {
    console.error("Failed to reset password:", err);
    setError("This reset link is invalid or has expired. Please request a new one.");
    setStatus("invalid");
    setSubmitting(false);
    return;
  }

  // Step 2: sign in with the new password to get a fresh ID token
  let idToken;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    idToken = await userCredential.user.getIdToken();
  } catch (err) {
    console.error("Sign-in after reset failed:", err);
    setError("Password was reset, but automatic sign-in failed. Please log in manually.");
    setSubmitting(false);
    return;
  }

  // Step 3: sync the new password to Django
  try {
    await axios.post(
      API_URLS.syncPassword,
      { access_token: idToken, new_password: password },
      { headers: { "Content-Type": "application/json" }, timeout: 10000 }
    );

    setStatus("success");
    setTimeout(() => navigate("/login"), 2000);
  } catch (err) {
    console.error("Password sync failed:", err.response?.data || err);
    setError(
      err.response?.data?.error ||
        "Your password was reset, but we couldn't sync your account. Please try logging in, or contact support."
    );
  } finally {
    setSubmitting(false);
  }
};

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#FBF9F5] px-6">
            <div className="w-full max-w-sm">
                <h1
                    className="text-[26px] text-[#1F2229] mb-1"
                    style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
                >
                    Set a new password
                </h1>
               
               
                <p className="text-[#8A8F98] text-sm mb-8">
                    for {email}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block">
                        <span className="block text-[12px] text-[#8A8F98] mb-1.5">New password</span>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter new password"
                            className="w-full bg-transparent border border-[#E4E0D6] rounded-sm px-3 py-2.5 text-[15px] text-[#1F2229] placeholder:text-[#B8BCC4] focus:outline-none focus:border-[#C98A3E] transition-colors"
                        />
                    </label>

                    <label className="block">
                        <span className="block text-[12px] text-[#8A8F98] mb-1.5">Confirm password</span>
                        <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter new password"
                            className="w-full bg-transparent border border-[#E4E0D6] rounded-sm px-3 py-2.5 text-[15px] text-[#1F2229] placeholder:text-[#B8BCC4] focus:outline-none focus:border-[#C98A3E] transition-colors"
                        />
                    </label>

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full mt-2 bg-[#1F2229] text-[#FBF9F5] rounded-sm py-3 text-[15px] hover:bg-[#14161B] transition-colors disabled:opacity-60"
                    >
                        {submitting ? "Updating..." : "Update password"}
                    </button>
                </form>
            </div>
        </div>
    );
}
