# Security Policy

## 🔐 Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## 🐛 Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

### Preferred Contact Method

Send an email to: **security@furgokid.app** (or repository owner email)

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### What to Expect

- **Initial Response**: Within 48 hours
- **Status Update**: Every 72 hours during investigation
- **Resolution Timeline**:
  - Critical: 7 days
  - High: 14 days
  - Medium: 30 days
  - Low: 90 days

### Disclosure Policy

- We follow **Coordinated Vulnerability Disclosure**
- Public disclosure only after fix is deployed
- Credit given to reporter (if desired)

## 🛡️ Security Measures

### Data Protection

- ✅ Firebase Auth with secure session tokens
- ✅ Firestore security rules enforced
- ✅ HTTPS-only communication
- ⚠️ Sensitive data in AsyncStorage (migration to SecureStore planned)

### Privacy

- ✅ GDPR consent modal
- ✅ Privacy Policy published
- ✅ PII scrubbing in Sentry logs
- ✅ Analytics opt-out available

### Code Security

- ✅ Dependency scanning with npm audit
- ✅ ESLint security rules
- ✅ Sentry error tracking
- ⚠️ Certificate pinning (planned for v1.1)

## 🔍 Known Issues

### Current Limitations

1. **AsyncStorage for Sensitive Data**: Tokens stored without encryption on device

   - **Mitigation**: Planning migration to expo-secure-store
   - **Risk**: Low (requires physical device access + root/jailbreak)

2. **No Certificate Pinning**: SSL/TLS connections use system trust store

   - **Mitigation**: Planned for v1.1
   - **Risk**: Medium (potential MITM on compromised networks)

3. **Client-Side Rate Limiting Only**: No server-side throttling
   - **Mitigation**: Firestore security rules + exponential backoff
   - **Risk**: Low (Firebase has built-in DDoS protection)

## 📋 Security Checklist (Pre-Production)

- [ ] Rotate all API keys and secrets
- [ ] Enable Firebase App Check
- [ ] Configure Firestore security rules with rate limiting
- [ ] Migrate sensitive data to SecureStore
- [ ] Enable ProGuard/R8 obfuscation
- [ ] Setup Firebase budget alerts
- [ ] Configure HTTPS-only in app.config.js
- [ ] Review and remove debug logs
- [ ] Enable Sentry in production
- [ ] Test with OWASP Mobile Security Testing Guide

## 🚨 Incident Response

### In Case of Security Breach

1. **Immediate Actions**:

   - Disable affected systems/features
   - Notify security team
   - Preserve logs and evidence

2. **Investigation**:

   - Assess scope and impact
   - Identify affected users
   - Determine root cause

3. **Remediation**:

   - Deploy security patch
   - Rotate compromised credentials
   - Notify affected users (if PII exposed)

4. **Post-Mortem**:
   - Document lessons learned
   - Update security measures
   - File ADR (Architecture Decision Record)

## 📞 Contact

- **Security Email**: security@furgokid.app
- **GitHub Issues**: For non-security bugs only
- **Response Time**: 48 hours for security issues

## 🔄 Updates

This security policy is reviewed quarterly and updated as needed.

**Last Updated**: December 30, 2025
