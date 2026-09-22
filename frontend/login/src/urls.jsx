export const BASE_URL = "http://127.0.0.1:8000";
 
export const API_URLS = {
  forgotPassword: `${BASE_URL}/api/forgot-password/`,
  firebaseLogin: `${BASE_URL}/api/firebase-login/`,
//   login: `${BASE_URL}/api/login/`, 
  logout: `${BASE_URL}/logout/`,
  // Confirmed against urls.py: path("sync-password/", sync_password_after_reset, ...)
  syncPassword: `${BASE_URL}/api/sync-password/`,
};
 
export default API_URLS;