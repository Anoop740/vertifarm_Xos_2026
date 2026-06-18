"""
Email service — uses Resend when API key is set, otherwise logs to console.
"""
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, html: str) -> bool:
    if not settings.RESEND_API_KEY:
        logger.info(f"[EMAIL-DEV] To: {to} | Subject: {subject}")
        logger.info(f"[EMAIL-DEV] Body preview: {html[:200]}...")
        return True
    try:
        import resend
        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send({
            "from": f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM_ADDRESS}>",
            "to": [to],
            "subject": subject,
            "html": html,
        })
        return True
    except Exception as e:
        logger.error(f"Email send failed to {to}: {e}")
        return False


def _base_template(content: str, preheader: str = "") -> str:
    return f"""
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f4f8;margin:0;padding:40px 20px}}
.card{{background:#fff;border-radius:16px;padding:40px;max-width:520px;margin:0 auto;box-shadow:0 4px 20px rgba(15,23,42,.08)}}
.logo{{display:flex;align-items:center;gap:10px;margin-bottom:32px}}
.logo-icon{{width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#00d4aa,#00b892);display:inline-block}}
.logo-name{{font-size:18px;font-weight:800;color:#0f172a}}
.logo-name span{{color:#00d4aa}}
h1{{font-size:24px;font-weight:800;color:#0f172a;margin:0 0 12px}}
p{{font-size:15px;color:#475569;line-height:1.65;margin:0 0 20px}}
.btn{{display:inline-block;padding:13px 28px;background:linear-gradient(135deg,#00d4aa,#00b892);color:#030c14;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px}}
.divider{{border:none;border-top:1px solid #e2e8f0;margin:28px 0}}
.small{{font-size:12px;color:#94a3b8}}
.footer{{text-align:center;margin-top:24px;font-size:12px;color:#94a3b8}}
</style></head><body>
<div class="card">
<div class="logo">
  <div class="logo-icon"></div>
  <div class="logo-name">Verti<span>Farm</span> XOS</div>
</div>
{content}
<div class="divider"></div>
<div class="small">This email was sent by VertiFarm Technologies Pvt Ltd.<br>
If you did not request this, you can safely ignore this email.</div>
</div>
<div class="footer">© 2026 VertiFarm Technologies Pvt Ltd · Made in India 🇮🇳</div>
</body></html>
"""


async def send_welcome_email(to: str, name: str, org_name: str, verify_url: str) -> bool:
    html = _base_template(f"""
<h1>Welcome to VertiFarm XOS! 🌿</h1>
<p>Hi {name},</p>
<p>Your organization <strong>{org_name}</strong> has been created. You have a <strong>14-day free trial</strong> with full access to all Growth features.</p>
<p>Please verify your email address to activate your account:</p>
<a href="{verify_url}" class="btn">Verify Email Address</a>
<br><br>
<p class="small">This link expires in 24 hours. If you didn't create this account, please ignore this email.</p>
""")
    return await send_email(to, "Welcome to VertiFarm XOS — Verify your email", html)


async def send_verify_email(to: str, name: str, verify_url: str) -> bool:
    html = _base_template(f"""
<h1>Verify your email</h1>
<p>Hi {name}, click the button below to verify your email address for VertiFarm XOS:</p>
<a href="{verify_url}" class="btn">Verify Email Address</a>
<br><br>
<p class="small">Link expires in 24 hours.</p>
""")
    return await send_email(to, "VertiFarm XOS — Verify your email address", html)


async def send_reset_password_email(to: str, name: str, reset_url: str) -> bool:
    html = _base_template(f"""
<h1>Reset your password</h1>
<p>Hi {name}, we received a request to reset your VertiFarm XOS password.</p>
<a href="{reset_url}" class="btn">Reset Password</a>
<br><br>
<p class="small">This link expires in 2 hours. If you didn't request a password reset, you can safely ignore this email.</p>
""")
    return await send_email(to, "VertiFarm XOS — Reset your password", html)


async def send_invitation_email(to: str, inviter_name: str, org_name: str, role: str, accept_url: str) -> bool:
    html = _base_template(f"""
<h1>You're invited to join {org_name}</h1>
<p><strong>{inviter_name}</strong> has invited you to join <strong>{org_name}</strong> on VertiFarm XOS as a <strong>{role.replace('_', ' ').title()}</strong>.</p>
<a href="{accept_url}" class="btn">Accept Invitation</a>
<br><br>
<p class="small">This invitation expires in 72 hours.</p>
""")
    return await send_email(to, f"You're invited to join {org_name} on VertiFarm XOS", html)


async def send_payment_failed_email(to: str, name: str, org_name: str, amount_inr: int, retry_url: str) -> bool:
    html = _base_template(f"""
<h1>Payment failed</h1>
<p>Hi {name}, we were unable to process your payment of <strong>₹{amount_inr/100:,.0f}</strong> for <strong>{org_name}</strong>.</p>
<p>Please update your payment method to continue using VertiFarm XOS without interruption.</p>
<a href="{retry_url}" class="btn">Update Payment Method</a>
""")
    return await send_email(to, "VertiFarm XOS — Action required: Payment failed", html)


async def send_trial_ending_email(to: str, name: str, org_name: str, days_left: int, upgrade_url: str) -> bool:
    html = _base_template(f"""
<h1>Your trial ends in {days_left} day{'s' if days_left != 1 else ''}</h1>
<p>Hi {name}, your free trial for <strong>{org_name}</strong> will end in <strong>{days_left} day{'s' if days_left != 1 else ''}</strong>.</p>
<p>Upgrade now to continue growing with VertiFarm XOS — no downtime, all your data is preserved.</p>
<a href="{upgrade_url}" class="btn">Upgrade Now</a>
""")
    return await send_email(to, f"VertiFarm XOS — {days_left} day{'s' if days_left != 1 else ''} left in your trial", html)
