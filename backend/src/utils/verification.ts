import { prisma } from '../lib/prisma';
import { EmailService } from '../services/emailService';

export const generateVerificationCode = () => {
  // Generate a 6-digit code
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendVerificationEmail = async (userId: string) => {
  const user = await prisma.users.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Generate new verification code
  const verificationCode = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

  // Update user with new verification code
  await prisma.users.update({
    where: { id: userId },
    data: {
      verificationCode,
      verificationExpires: expiresAt
    }
  });

  // Send verification email
  const emailService = EmailService.getInstance();
  await emailService.sendEmail({
    templateName: 'email_verification',
    toEmail: user.email,
    toName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
    recipientId: user.id,
    variables: {
      firstName: user.firstName || 'there',
      verificationCode
    }
  });

  return verificationCode;
}; 