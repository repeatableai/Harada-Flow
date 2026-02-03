import { Resend } from 'resend';
import config from '../config.js';

let resend = null;

if (config.email.resendApiKey) {
  resend = new Resend(config.email.resendApiKey);
}

export async function sendVerificationEmail(email, code) {
  // In development without Resend configured, just log to console
  if (!resend || config.nodeEnv === 'development') {
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
