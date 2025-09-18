import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import validator from 'validator';

// Rate limiting for authentication attempts
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per windowMs
  message: { error: 'Too many login attempts, please try again later' }
});

// Rate limiting for registration
export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registration attempts per hour
  message: { error: 'Too many registration attempts, please try again later' }
});

// Rate limiting for password reset requests
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 reset attempts per hour
  message: { error: 'Too many password reset attempts, please try again later' }
});

// Sanitize input data
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = validator.escape(req.body[key]);
      }
    });
  }

  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = validator.escape(req.query[key] as string);
      }
    });
  }

  next();
};

// Security headers middleware
export const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
};

// Security logging middleware
export const securityLogger = (req: Request, _res: Response, next: NextFunction): void => {
  // Log potentially suspicious requests
  const suspiciousPatterns = [
    'eval(',
    'javascript:',
    'data:',
    '<script',
    'alert(',
    'document.cookie',
    'onerror=',
    'onload=',
    'onclick=',
    'onmouseover='
  ];

  const requestData = {
    method: req.method,
    url: req.url,
    query: req.query,
    body: req.body,
    headers: req.headers,
    ip: req.ip
  };

  const requestString = JSON.stringify(requestData).toLowerCase();
  
  suspiciousPatterns.forEach(pattern => {
    if (requestString.includes(pattern.toLowerCase())) {
      console.warn(`[Security Warning] Suspicious pattern detected: ${pattern}`);
      console.warn('Request details:', {
        ip: req.ip,
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent']
      });
    }
  });

  next();
};

// Token format validation
export const validateTokenFormat = (req: Request, res: Response, next: NextFunction): void | Response => {
  const token = req.cookies.accessToken;

  if (token) {
    // Basic JWT format validation (header.payload.signature)
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    
    if (!jwtRegex.test(token)) {
      return res.status(401).json({
        error: 'Invalid token format'
      });
    }
  }

  next();
};

// Block common attack patterns
export const blockAttackPatterns = (req: Request, res: Response, next: NextFunction): void | Response => {
  const path = req.path.toLowerCase();
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const queryString = JSON.stringify(req.query).toLowerCase();
  const body = JSON.stringify(req.body).toLowerCase();

  // Block known malicious paths
  const blockedPaths = [
    '/wp-admin',
    '/wp-login',
    '/wp-content',
    '/phpinfo',
    '/phpmyadmin',
    '/.env',
    '/.git',
    '/config',
    '/backup',
    '/admin'
  ];

  if (blockedPaths.some(p => path.includes(p))) {
    console.warn(`[Security] Blocked access to suspicious path: ${path}`);
    return res.status(403).json({
      error: 'Access denied'
    });
  }

  // Block suspicious user agents
  const suspiciousAgents = [
    'sqlmap',
    'nikto',
    'nmap',
    'masscan',
    'python-requests',
    'curl',
    'wget',
    'postman',
    'burp'
  ];

  if (suspiciousAgents.some(agent => userAgent.includes(agent))) {
    console.warn(`[Security] Blocked suspicious user agent: ${userAgent}`);
    return res.status(403).json({
      error: 'Access denied'
    });
  }

  // Block SQL injection attempts
  const sqlInjectionPatterns = [
    'union select',
    'union all select',
    'or 1=1',
    'or true--',
    'or \'1\'=\'1',
    'having 1=1',
    'group by',
    'order by',
    'information_schema'
  ];

  if (sqlInjectionPatterns.some(pattern => 
    queryString.includes(pattern) || body.includes(pattern)
  )) {
    console.warn(`[Security] Blocked potential SQL injection attempt`);
    return res.status(403).json({
      error: 'Access denied'
    });
  }

  next();
}; 