import { Resend } from 'resend';
import config from '../config.js';

let resend = null;

console.log(`[Email Service] RESEND_API_KEY present: ${!!config.email.resendApiKey}, length: ${config.email.resendApiKey?.length || 0}, from: ${config.email.from}`);

if (config.email.resendApiKey) {
  resend = new Resend(config.email.resendApiKey);
  console.log('[Email Service] Resend client initialized');
} else {
  console.log('[Email Service] Resend client NOT initialized — emails will log to console only');
}

// Get the frontend URL for email links
function getFrontendUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:5174';
}

export async function sendVerificationEmail(email, code) {
  // If Resend not configured, just log to console
  if (!resend) {
    console.log(`\n========================================`);
    console.log(`Verification code for ${email}: ${code}`);
    console.log(`========================================\n`);

    if (!resend) {
      console.log('(Email not sent - RESEND_API_KEY not configured)');
    }
    return { success: true, method: 'console' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: config.email.from,
      to: email,
      subject: 'Your Role Deliverable Matrices Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e40af;">Role Deliverable Matrices - Verification Code</h2>
          <p>Your verification code is:</p>
          <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 10px; letter-spacing: 8px; margin: 20px 0;">
            ${code}
          </div>
          <p style="color: #666;">This code will expire in 5 minutes.</p>
          <p style="color: #666;">If you didn't request this code, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">Powered by Repeatable AI</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      throw new Error('Failed to send verification email');
    }

    console.log(`Verification email sent to ${email}, id: ${data.id}`);
    return { success: true, method: 'email', id: data.id };
  } catch (error) {
    console.error('Email sending failed:', error);
    // Fall back to console logging
    console.log(`\n========================================`);
    console.log(`Verification code for ${email}: ${code}`);
    console.log(`========================================\n`);
    return { success: true, method: 'console_fallback' };
  }
}

export async function sendPasswordResetEmail(email, name, token) {
  const resetUrl = `${getFrontendUrl()}/reset-password?token=${token}`;

  // If Resend not configured, just log to console
  if (!resend) {
    console.log(`\n========================================`);
    console.log(`Password reset link for ${email}:`);
    console.log(resetUrl);
    console.log(`========================================\n`);

    if (!resend) {
      console.log('(Email not sent - RESEND_API_KEY not configured)');
    }
    return { success: true, method: 'console', resetUrl };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: config.email.from,
      to: email,
      subject: 'Reset Your Password - Role Deliverable Matrices',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e40af;">Reset Your Password</h2>
          <p>Hi ${name || 'there'},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; font-size: 16px; font-weight: bold; text-decoration: none; padding: 15px 30px; border-radius: 8px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #666;">This link will expire in 1 hour.</p>
          <p style="color: #666;">If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #999; font-size: 12px; word-break: break-all;">${resetUrl}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">Powered by Repeatable AI</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      throw new Error('Failed to send password reset email');
    }

    console.log(`Password reset email sent to ${email}, id: ${data.id}`);
    return { success: true, method: 'email', id: data.id };
  } catch (error) {
    console.error('Email sending failed:', error);
    // Fall back to console logging
    console.log(`\n========================================`);
    console.log(`Password reset link for ${email}:`);
    console.log(resetUrl);
    console.log(`========================================\n`);
    return { success: true, method: 'console_fallback', resetUrl };
  }
}

export async function sendInviteEmail(email, name, token) {
  const inviteUrl = `${getFrontendUrl()}/set-password?token=${token}`;
  console.log(`[sendInviteEmail] Called for ${email}, resend initialized: ${!!resend}, inviteUrl: ${inviteUrl}`);

  // If Resend not configured, just log to console
  if (!resend) {
    console.log(`\n========================================`);
    console.log(`Invite link for ${email}:`);
    console.log(inviteUrl);
    console.log(`========================================\n`);

    if (!resend) {
      console.log('(Email not sent - RESEND_API_KEY not configured)');
    }
    return { success: true, method: 'console', inviteUrl };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: config.email.from,
      to: email,
      subject: 'Welcome to Role Deliverable Matrices - Set Up Your Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e40af;">Welcome to Role Deliverable Matrices!</h2>
          <p>Hi ${name || 'there'},</p>
          <p>You've been invited to join Role Deliverable Matrices. Click the button below to set up your password and get started:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; font-size: 16px; font-weight: bold; text-decoration: none; padding: 15px 30px; border-radius: 8px; display: inline-block;">
              Set Up Your Account
            </a>
          </div>
          <p style="color: #666;">This link will expire in 7 days.</p>
          <p style="color: #666;">If you weren't expecting this invitation, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #999; font-size: 12px; word-break: break-all;">${inviteUrl}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">Powered by Repeatable AI</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      throw new Error('Failed to send invite email');
    }

    console.log(`Invite email sent to ${email}, id: ${data.id}`);
    return { success: true, method: 'email', id: data.id };
  } catch (error) {
    console.error('Email sending failed:', error);
    // Fall back to console logging
    console.log(`\n========================================`);
    console.log(`Invite link for ${email}:`);
    console.log(inviteUrl);
    console.log(`========================================\n`);
    return { success: true, method: 'console_fallback', inviteUrl };
  }
}

export async function sendAccessApprovedEmail(email, name) {
  const loginUrl = `${getFrontendUrl()}/`;

  // If Resend not configured, just log to console
  if (!resend) {
    console.log(`\n========================================`);
    console.log(`ACCESS APPROVED EMAIL to ${email}`);
    console.log(`Hi ${name}, your access request has been approved!`);
    console.log(`Login at: ${loginUrl}`);
    console.log(`Note: Trial account - limited to 3 saved deliverables`);
    console.log(`========================================\n`);

    if (!resend) {
      console.log('(Email not sent - RESEND_API_KEY not configured)');
    }
    return { success: true, method: 'console' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: config.email.from,
      to: email,
      subject: 'Your Access Request Has Been Approved - Role Deliverable Matrices',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #22c55e;">Access Approved!</h2>
          <p>Hi ${name || 'there'},</p>
          <p>Great news! Your request for temporary access to Role Deliverable Matrices has been approved.</p>

          <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <p style="margin: 0; color: #166534;"><strong>Trial Account Details:</strong></p>
            <ul style="color: #166534; margin: 10px 0;">
              <li>You can save up to <strong>3 deliverables</strong></li>
              <li>After that, your account will be view-only</li>
              <li>Contact an administrator to upgrade your account for full access</li>
            </ul>
          </div>

          <p>You can now sign in using the email and password you provided when requesting access.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background: linear-gradient(135deg, #22c55e, #16a34a); color: white; font-size: 16px; font-weight: bold; text-decoration: none; padding: 15px 30px; border-radius: 8px; display: inline-block;">
              Sign In Now
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">Powered by Repeatable AI</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      throw new Error('Failed to send approval email');
    }

    console.log(`Access approved email sent to ${email}, id: ${data.id}`);
    return { success: true, method: 'email', id: data.id };
  } catch (error) {
    console.error('Email sending failed:', error);
    // Fall back to console logging
    console.log(`\n========================================`);
    console.log(`ACCESS APPROVED EMAIL to ${email}`);
    console.log(`Hi ${name}, your access request has been approved!`);
    console.log(`Login at: ${loginUrl}`);
    console.log(`========================================\n`);
    return { success: true, method: 'console_fallback' };
  }
}

export async function sendAccessRejectedEmail(email, name, reason = null) {
  // If Resend not configured, just log to console
  if (!resend) {
    console.log(`\n========================================`);
    console.log(`ACCESS REJECTED EMAIL to ${email}`);
    console.log(`Hi ${name}, your access request was not approved.`);
    if (reason) console.log(`Reason: ${reason}`);
    console.log(`========================================\n`);

    if (!resend) {
      console.log('(Email not sent - RESEND_API_KEY not configured)');
    }
    return { success: true, method: 'console' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: config.email.from,
      to: email,
      subject: 'Update on Your Access Request - Role Deliverable Matrices',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e40af;">Access Request Update</h2>
          <p>Hi ${name || 'there'},</p>
          <p>Thank you for your interest in Role Deliverable Matrices.</p>
          <p>After reviewing your request, we are unable to approve access at this time.</p>

          ${reason ? `
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #374151;"><strong>Reason:</strong> ${reason}</p>
          </div>
          ` : ''}

          <p>If you believe this was in error or would like more information, please contact our support team.</p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">Powered by Repeatable AI</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      throw new Error('Failed to send rejection email');
    }

    console.log(`Access rejected email sent to ${email}, id: ${data.id}`);
    return { success: true, method: 'email', id: data.id };
  } catch (error) {
    console.error('Email sending failed:', error);
    // Fall back to console logging
    console.log(`\n========================================`);
    console.log(`ACCESS REJECTED EMAIL to ${email}`);
    console.log(`Hi ${name}, your access request was not approved.`);
    if (reason) console.log(`Reason: ${reason}`);
    console.log(`========================================\n`);
    return { success: true, method: 'console_fallback' };
  }
}

export async function sendAccessRequestNotification(request, superAdminEmails) {
  const frontendUrl = getFrontendUrl();
  const approveUrl = `${frontendUrl}/admin?tab=access-requests&action=approve&id=${request.id}`;
  const rejectUrl = `${frontendUrl}/admin?tab=access-requests&action=reject&id=${request.id}`;

  // If Resend not configured, just log to console
  if (!resend) {
    console.log(`\n========================================`);
    console.log(`NEW ACCESS REQUEST from ${request.name} (${request.email})`);
    console.log(`Company: ${request.company}`);
    console.log(`Job Title: ${request.jobTitle}`);
    console.log(`Review at: ${frontendUrl}/admin?tab=access-requests`);
    console.log(`========================================\n`);

    if (!resend) {
      console.log('(Email not sent - RESEND_API_KEY not configured)');
    }
    return { success: true, method: 'console' };
  }

  try {
    // Send email to all super admins
    for (const adminEmail of superAdminEmails) {
      const { data, error } = await resend.emails.send({
        from: config.email.from,
        to: adminEmail,
        subject: `New Access Request - ${request.name} from ${request.company}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e40af;">New Temporary Access Request</h2>
            <p>A new user has requested temporary access to Role Deliverable Matrices:</p>

            <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <p><strong>Name:</strong> ${request.name}</p>
              <p><strong>Email:</strong> ${request.email}</p>
              <p><strong>Company:</strong> ${request.company}</p>
              <p><strong>Job Title:</strong> ${request.jobTitle}</p>
              <p><strong>Requested:</strong> ${new Date(request.createdAt).toLocaleString()}</p>
            </div>

            <p>Trial users are limited to <strong>3 saved deliverables</strong> before their access becomes view-only.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${approveUrl}" style="background: linear-gradient(135deg, #22c55e, #16a34a); color: white; font-size: 16px; font-weight: bold; text-decoration: none; padding: 15px 30px; border-radius: 8px; display: inline-block; margin-right: 10px;">
                Approve
              </a>
              <a href="${rejectUrl}" style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; font-size: 16px; font-weight: bold; text-decoration: none; padding: 15px 30px; border-radius: 8px; display: inline-block;">
                Reject
              </a>
            </div>

            <p style="color: #666;">Or review all pending requests in the <a href="${frontendUrl}/admin?tab=access-requests">Admin Dashboard</a>.</p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">Powered by Repeatable AI</p>
          </div>
        `,
      });

      if (error) {
        console.error('Resend error:', error);
      } else {
        console.log(`Access request notification sent to ${adminEmail}, id: ${data.id}`);
      }
    }

    return { success: true, method: 'email' };
  } catch (error) {
    console.error('Email sending failed:', error);
    // Fall back to console logging
    console.log(`\n========================================`);
    console.log(`NEW ACCESS REQUEST from ${request.name} (${request.email})`);
    console.log(`Company: ${request.company}`);
    console.log(`Job Title: ${request.jobTitle}`);
    console.log(`Review at: ${frontendUrl}/admin?tab=access-requests`);
    console.log(`========================================\n`);
    return { success: true, method: 'console_fallback' };
  }
}
