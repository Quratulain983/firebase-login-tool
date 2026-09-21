import json
import secrets
import string
import logging

from firebase_admin import auth as firebase_auth
from django.conf import settings
from django.contrib.auth.hashers import make_password, check_password
from django.core.mail import send_mail
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .models import User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from .models import User, UserSession
from user_agents import parse as parse_user_agent
from django.utils import timezone
from datetime import timedelta
import re




logger = logging.getLogger(__name__)


def get_client_ip(request):
    ip = request.META.get("HTTP_X_FORWARDED_FOR")
    if ip:
        ip = ip.split(",")[0].strip()
    else:
        ip = request.META.get("REMOTE_ADDR")
    return ip

def generate_random_password(length=12):
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


@csrf_exempt
@require_POST
def firebase_login(request):
    try:
        data = json.loads(request.body)

        access_token = data.get("access_token")

        if not access_token:
            return JsonResponse(
                {"error": "access_token is required"},
                status=400
            )

        # 1. Verify Google/Firebase ID token
        decoded_token = firebase_auth.verify_id_token(access_token)

        firebase_uid = decoded_token.get("uid")
        email = decoded_token.get("email")
        name = decoded_token.get("name") or data.get("name", "")

        if not firebase_uid or not email:
            return JsonResponse(
                {"error": "Firebase token does not contain uid/email"},
                status=400
            )

        email = email.strip().lower()

        # 2. Find existing user or create user
        user, created = User.objects.get_or_create(
            firebase_uid=firebase_uid,
            defaults={
                "email": email,
                "name": name,
            },
        )

        # 3. Existing user
        if not created:
            user.email = email
            user.name = name
            user.save(update_fields=["email", "name"])

            device_name, device_type = get_device_info(request)

            session = UserSession.objects.create(
                user=user,
                device=device_name,
                device_type=device_type,
                user_agent=request.META.get("HTTP_USER_AGENT", ""),
                ip_address=get_client_ip(request),
                expires_at=timezone.now() + timedelta(days=30),
            )

            return JsonResponse({
                "message": "Firebase login successful",
                "created": False,
                "email_sent": False,
                "logged_in_at": session.created_at.isoformat(),
                "user": {
                    "id": user.id,
                    "firebase_uid": user.firebase_uid,
                    "email": user.email,
                    "name": user.name,
                }
            })
                    # Manual signup (email + password): no random password needed
        
        if decoded_token.get("firebase", {}).get("sign_in_provider") == "password":
            print("sign up using paswword9999999999999999999999999999999999999999")
            password = data.get("password")
            if password:
                user.password = make_password(password)
                user.save(update_fields=["password"])


            return JsonResponse({
                "message": "VMS account created successfully",
                "created": True,
                "email_sent": False,
                "user": {
                    "id": user.id,
                    "firebase_uid": user.firebase_uid,
                    "email": user.email,
                    "name": user.name,
                }
            })

        # 4. NEW USER
        # Generate custom VMS password
        raw_password = generate_random_password(12)

        # Store ONLY the hash
        user.password = make_password(raw_password)

        user.save(update_fields=["password"])

        # 5. Send VMS credentials by email
        
        username_display = user.name or email.split("@")[0]
        login_url = settings.FRONTEND_LOGIN_URL

        try:
            firebase_reset_link = firebase_auth.generate_password_reset_link(email)
            oob_code_match = re.search(r"oobCode=([^&]+)", firebase_reset_link)
            oob_code = oob_code_match.group(1) if oob_code_match else None

            if oob_code:
                base_url = settings.FRONTEND_LOGIN_URL.rsplit('/login', 1)[0]
                reset_link = f"{base_url}/reset-password?mode=resetPassword&oobCode={oob_code}"
            else:
                reset_link = None
        except Exception:
            logger.exception("Failed to generate Firebase password reset link")
            reset_link = None

        message = f"""
Welcome to MexemAI VMS.

Your VMS account has been created.

Name: {username_display}
Email: {user.email}

VMS Password: {raw_password}
Login: {login_url}
"""

        if reset_link:
            message += f"""
Required password setup/reset link: {reset_link}

For security, this password is temporary. Please use the secure link above to set your own password before using the account long term.
"""

        message += """
Use the above email and password to log in to MexemAI VMS.

IMPORTANT:
This password is ONLY for MexemAI VMS.
It is NOT your Google/Gmail password.

Do not share your Google/Gmail password with anyone.
"""

        email_sent = True
        try:

                send_mail(
                    subject="Your MexemAI VMS Account",
                    message=message.strip(),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email],
                )
        except Exception:
            logger.exception("Failed to send welcome email")
            email_sent = False

        # 6. Return response
        return JsonResponse({
            "message": "VMS account created successfully",
            "created": True,
            "email_sent": True,
            "user": {
                "id": user.id,
                "firebase_uid": user.firebase_uid,
                "email": user.email,
                "name": user.name,
            }
        })

    except firebase_auth.InvalidIdTokenError:
        return JsonResponse(
            {"error": "Invalid Firebase token"},
            status=401
        )

    except Exception as e:
        logger.exception("firebase_login failed")

        return JsonResponse(
            {"error": str(e)},
            status=500
        )




@csrf_exempt
@require_POST
def login_view(request):
    try:
        data = json.loads(request.body)

        email = data.get("email", "").strip().lower()
        password = data.get("password", "")

        print("EMAIL RECEIVED:", repr(email))
        print("PASSWORD RECEIVED:", repr(password))

        if not email or not password:
            return JsonResponse(
                {"error": "Email and password are required"},
                status=400
            )

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            print("USER NOT FOUND")
            return JsonResponse(
                {"error": "Invalid email or password"},
                status=401
            )

        print("USER FOUND:", user.email)
        print("PASSWORD HASH EXISTS:", bool(user.password))

        password_valid = check_password(
            password,
            user.password
        )

        print("PASSWORD VALID:", password_valid)

        if not password_valid:
            return JsonResponse(
                {"error": "Invalid email or password"},
                status=401
            )
       
        return JsonResponse({
            "message": "VMS login successful",
            "logged_in_at": session.created_at.isoformat(),
            "user": {
                "id": user.id,
                "firebase_uid": user.firebase_uid,
                "email": user.email,
                "name": user.name,
            }
        })

    except Exception as e:
        logger.exception("login_view failed")

        return JsonResponse(
            {"error": str(e)},
            status=500
        )


def get_device_info(request):
    ua_string = request.META.get("HTTP_USER_AGENT", "")
    user_agent = parse_user_agent(ua_string)

    if user_agent.is_mobile:
        device_type = "mobile"
    elif user_agent.is_tablet:
        device_type = "tablet"
    elif user_agent.is_pc:
        device_type = "desktop"
    else:
        device_type = "other"

    device_name = user_agent.device.family

    return device_name, device_type

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_sessions_view(request):

    sessions = UserSession.objects.filter(user=request.user).order_by("-created_at")

    data = []
    for s in sessions:
        data.append({
            "id": str(s.id),
            "device": s.device,
            "device_type": s.device_type,
            "user_agent": s.user_agent,
            "ip_address": s.ip_address,
            "is_active": s.is_active,
            "created_at": s.created_at,
            "last_used_at": s.last_used_at,
            "expires_at": s.expires_at,
        })

    return JsonResponse({
        "success": True,
        "count": len(data),
        "sessions": data
    })


@csrf_exempt
@require_POST
def sync_password_after_reset(request):
    try:
        data = json.loads(request.body)

        access_token = data.get("access_token")
        new_password = data.get("new_password")

        if not access_token or not new_password:
            return JsonResponse(
                {"error": "access_token and new_password are required"},
                status=400
            )

        # 1. Verify the user via Firebase (proves they own this account)
        decoded_token = firebase_auth.verify_id_token(access_token)
        firebase_uid = decoded_token.get("uid")

        if not firebase_uid:
            return JsonResponse({"error": "Invalid token"}, status=400)

        # 2. Match user in Django DB
        try:
            user = User.objects.get(firebase_uid=firebase_uid)
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found"}, status=404)

        # 3. Move current password to old_password, store new one
        user.old_password = user.password
        user.password = make_password(new_password)
        user.save(update_fields=["password", "old_password"])

        return JsonResponse({
            "message": "Password synced successfully",
        })

    except firebase_auth.InvalidIdTokenError:
        return JsonResponse({"error": "Invalid Firebase token"}, status=401)
    except Exception as e:
        logger.exception("sync_password_after_reset failed")
        return JsonResponse({"error": str(e)}, status=500)
    
    
# forgot passowrd//
@csrf_exempt
@require_POST
def forgot_password(request):
    generic = JsonResponse({
        "message": "If an account exists for that email, a reset link has been sent."
    })
    try:
        data = json.loads(request.body)
        email = (data.get("email") or "").strip().lower()

        if not email:
            return JsonResponse({"error": "Email is required"}, status=400)

        try:
            firebase_link = firebase_auth.generate_password_reset_link(email)
        except Exception:
            logger.info("Password reset requested for unknown/invalid email")
            return generic

        match = re.search(r"oobCode=([^&]+)", firebase_link)
        if not match:
            logger.error("No oobCode in Firebase reset link")
            return generic

        base_url = settings.FRONTEND_LOGIN_URL.rsplit("/login", 1)[0]
        reset_link = f"{base_url}/reset-password?mode=resetPassword&oobCode={match.group(1)}"

        message = f"""
Hello,

We received a request to reset your MexemAI VMS password.

Click the link below to set a new password:
{reset_link}

This link expires soon and can only be used once.
If you didn't request this, you can safely ignore this email.
"""
        send_mail(
            subject="Reset your MexemAI VMS password",
            message=message.strip(),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
        )
        return generic

    except Exception:
        logger.exception("forgot_password failed")
        return JsonResponse({"error": "Something went wrong. Please try again."}, status=500)