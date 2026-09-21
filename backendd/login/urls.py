from django.urls import path
from .views import firebase_login,login_view,user_sessions_view,sync_password_after_reset,forgot_password

urlpatterns = [
    path("firebase-login/", firebase_login, name="firebase_login"),
    path("login/", login_view, name="login"),
    path("sessions/", user_sessions_view, name="user_sessions"),
    path("sync-password/", sync_password_after_reset, name="sync_password"),
    path("forgot-password/",forgot_password,name="forgot_password"),


    
    
]