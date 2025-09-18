import { prisma } from '../lib/prisma'
import Handlebars from 'handlebars'
import { queueService } from './queueService'

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  htmlContent: string
  textContent?: string
  variables?: string[]
  isActive: boolean
}

export interface SendEmailOptions {
  templateName: string
  toEmail: string
  toName?: string
  recipientId?: string
  variables?: Record<string, any>
  metadata?: any
}

export class EmailService {
  private static instance: EmailService

  private constructor() {}

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService()
    }
    return EmailService.instance
  }

  /**
   * Send an email using a template
   */
  async sendEmail(options: SendEmailOptions): Promise<string> {
    try {
      // Get template from database
      const template = await prisma.email_templates.findUnique({
        where: { name: options.templateName, isActive: true }
      })

      if (!template) {
        throw new Error(`Email template '${options.templateName}' not found or inactive`)
      }

      // Compile template with variables
      const compiledSubject = Handlebars.compile(template.subject)(options.variables || {})
      const compiledHtml = Handlebars.compile(template.htmlContent)(options.variables || {})
      const compiledText = template.textContent 
        ? Handlebars.compile(template.textContent)(options.variables || {})
        : undefined

      // Create notification record
      const notification = await prisma.email_notifications.create({
        data: {
          templateId: template.id,
          recipientId: options.recipientId,
          toEmail: options.toEmail,
          toName: options.toName,
          subject: compiledSubject,
          htmlContent: compiledHtml,
          textContent: compiledText,
          status: 'pending',
          metadata: options.metadata
        }
      })

      // Add to queue for processing
      await queueService.queueEmail({
        notificationId: notification.id,
        toEmail: options.toEmail,
        toName: options.toName,
        subject: compiledSubject,
        htmlContent: compiledHtml,
        textContent: compiledText,
        metadata: options.metadata
      })

      return notification.id

    } catch (error) {
      console.error('Failed to queue email:', error)
      throw error
    }
  }

  /**
   * Create or update email template
   */
  async createTemplate(template: Omit<EmailTemplate, 'id'>): Promise<EmailTemplate> {
    const result = await prisma.email_templates.upsert({
      where: { name: template.name },
      update: {
        subject: template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent,
        variables: template.variables,
        isActive: template.isActive
      },
      create: {
        name: template.name,
        subject: template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent,
        variables: template.variables,
        isActive: template.isActive
      }
    })

    return result as EmailTemplate
  }

  /**
   * Get email template by name
   */
  async getTemplate(name: string): Promise<EmailTemplate | null> {
    const template = await prisma.email_templates.findUnique({
      where: { name }
    })
    return template as EmailTemplate | null
  }
} 