from django.db import models
import uuid


# Create your models here.


class User(models.Model):
    firebase_uid = models.CharField(max_length=128, unique=True)
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255, blank=True)

    password = models.CharField(max_length=128, blank=True, null=True)
    old_password = models.CharField(max_length=128, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.email
    
    


class UserSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sessions"
    )

    device = models.CharField(max_length=255, blank=True, null=True)
    device_type = models.CharField(
        max_length=20,
        choices=[("mobile", "Mobile"), ("desktop", "Desktop"), ("tablet", "Tablet"), ("other", "Other")],
        default="other"
    )
    user_agent = models.TextField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_active"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.device or 'Unknown device'} ({self.ip_address})"

    def is_expired(self):
        if self.expires_at:
            return timezone.now() > self.expires_at
        return False

    def revoke(self):
        self.is_active = False
        self.save(update_fields=["is_active"])