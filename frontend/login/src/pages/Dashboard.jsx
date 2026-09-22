import React, { useState, useEffect } from "react";
import { LogOut, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";


export default function Dashboard() {

  const navigate = useNavigate(); 
  const [user, setUser] = useState(null);
  const [loggedInAt, setLoggedInAt] = useState(null);
  const [elapsed, setElapsed] = useState("0s");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedLoginTime = localStorage.getItem("loggedInAt");

    // if (!storedUser || !storedLoginTime) {
    //   window.location.href = "/login";
    //   return;
    // }

    setUser(JSON.parse(storedUser));
    setLoggedInAt(storedLoginTime);
  }, []);

  useEffect(() => {
    if (!loggedInAt) return;

    const loginTime = new Date(loggedInAt).getTime();

    const tick = () => {
      const diffSec = Math.floor((Date.now() - loginTime) / 1000);

      const hrs = Math.floor(diffSec / 3600);
      const mins = Math.floor((diffSec % 3600) / 60);
      const secs = diffSec % 60;

      const parts = [];
      if (hrs > 0) parts.push(`${hrs}h`);
      if (mins > 0 || hrs > 0) parts.push(`${mins}m`);
      parts.push(`${secs}s`);

      setElapsed(parts.join(" "));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [loggedInAt]);

 const handleLogout = async () => {
  const access = localStorage.getItem("access");
  const refresh = localStorage.getItem("refresh");

  try {
    await fetch(API_URLS.logout, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${access}`,
      },
      body: JSON.stringify({ refresh }),
    });
  } catch (err) {
    console.error("Logout request failed:", err);
  }

  localStorage.removeItem("user");
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  localStorage.removeItem("loggedInAt");

  navigate("/login");
};

  if (!user) return null;

  const formattedLoginTime = loggedInAt
    ? new Date(loggedInAt).toLocaleString()
    : "";

  return (
    <div className="min-h-screen w-full bg-[#FBF9F5] px-6 py-10 sm:px-10">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-sm bg-[#C98A3E] flex items-center justify-center">
              <span className="font-serif text-[#14161B] text-xs font-bold">
                V
              </span>
            </div>
            <span className="text-sm tracking-wide text-[#6B7078]">
              VMS Mexemai
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-[13px] text-[#8A8F98] hover:text-[#1F2229] transition-colors"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>

        <h1
          className="text-[26px] text-[#1F2229] mb-1"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          Welcome back, {user.username}
        </h1>

        <p className="text-[#8A8F98] text-sm mb-8">
          {user.email}
        </p>

        <div className="bg-white border border-[#E4E0D6] rounded-sm p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#FBF3E7] flex items-center justify-center">
            <Clock size={18} className="text-[#C98A3E]" />
          </div>

          <div>
            <p className="text-[13px] text-[#8A8F98]">
              Logged in at {formattedLoginTime}
            </p>
            <p className="text-[15px] text-[#1F2229] mt-0.5">
              Session active for <span className="font-medium">{elapsed}</span>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}