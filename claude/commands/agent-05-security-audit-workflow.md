# Security Audit Workflow

## Overview
This workflow orchestrates agents to perform a comprehensive security audit, identify vulnerabilities, implement fixes, and establish ongoing security monitoring.

## Workflow Prompt

"Perform complete security audit for [APPLICATION] covering:
- OWASP Top 10 vulnerabilities
- API security assessment
- Authentication/authorization review
- Data protection and encryption
- Infrastructure security
- Dependency vulnerabilities
- Compliance requirements (GDPR/HIPAA/SOC2)
- Security monitoring setup

## Agent Execution Sequence

### Phase 1: Initial Security Assessment (Day 1)

1. **backend-security-auditor**
   - Input: Full application access
   - Output: Comprehensive security report
   - Priority: Critical/High/Medium/Low findings
   - Time: 6 hours

2. **dependency-analyzer**
   - Input: All project dependencies
   - Output: CVE scan results
   - Critical: Known vulnerabilities
   - Time: 2 hours

3. **api-contract-designer**
   - Input: API specifications
   - Output: API security assessment
   - Focus: Authentication, rate limiting
   - Time: 2 hours

### Phase 2: Code Security Analysis (Day 2)

4. **senior-js-engineer** / **strict-react-reviewer**
   - Input: Frontend codebase
   - Output: Client-side security audit
   - Focus: XSS, CSRF, data exposure
   - Time: 4 hours

5. **cpp-code-reviewer** (if applicable)
   - Input: Native code components
   - Output: Memory safety audit
   - Focus: Buffer overflows, injection
   - Time: 3 hours

6. **efficiency-code-auditor**
   - Input: Security-critical code paths
   - Output: Secure coding violations
   - Focus: Input validation, sanitization
   - Time: 3 hours

### Phase 3: Infrastructure Security (Day 3)

7. **infrastructure-cost-optimizer**
   - Input: Cloud infrastructure
   - Output: Security configuration audit
   - Focus: IAM, network, encryption
   - Time: 3 hours

8. **docker-compose-architect**
   - Input: Container configurations
   - Output: Container security audit
   - Focus: Base images, secrets, privileges
   - Time: 2 hours

9. **ci-cd-pipeline-builder**
   - Input: CI/CD pipelines
   - Output: Pipeline security audit
   - Focus: Secrets, access, artifacts
   - Time: 2 hours

### Phase 4: Data Security (Day 4)

10. **database-schema-architect**
    - Input: Database schemas
    - Output: Data security assessment
    - Focus: Encryption, access, PII
    - Time: 3 hours

11. **data-pipeline-designer**
    - Input: Data flows
    - Output: Data handling audit
    - Focus: Transit, processing, storage
    - Time: 3 hours

12. **analytics-event-architect**
    - Input: Analytics implementation
    - Output: Privacy compliance audit
    - Focus: GDPR, CCPA compliance
    - Time: 2 hours

### Phase 5: Authentication & Authorization (Day 5)

13. **backend-security-auditor**
    - Input: Auth systems
    - Output: Auth security deep dive
    - Focus: OAuth, JWT, sessions, MFA
    - Time: 4 hours

14. **api-contract-designer**
    - Input: API auth mechanisms
    - Output: API auth audit
    - Focus: Token management, scopes
    - Time: 2 hours

15. **design-pattern-advisor**
    - Input: Auth architecture
    - Output: Auth pattern recommendations
    - Focus: Zero trust, least privilege
    - Time: 2 hours

### Phase 6: Mobile Security (Day 6)

16. **mobile-performance-optimizer**
    - Input: Mobile applications
    - Output: Mobile security audit
    - Focus: Local storage, certificates
    - Time: 3 hours

17. **react-native-converter**
    - Input: React Native code
    - Output: RN security assessment
    - Focus: Bridge security, native modules
    - Time: 2 hours

18. **pwa-specialist**
    - Input: PWA implementation
    - Output: PWA security audit
    - Focus: Service workers, HTTPS
    - Time: 2 hours

### Phase 7: Penetration Testing Support (Day 7)

19. **e2e-test-architect**
    - Input: Security test scenarios
    - Output: Automated security tests
    - Focus: Auth bypass, injection
    - Time: 4 hours

20. **performance-test-engineer**
    - Input: DDoS scenarios
    - Output: Rate limiting validation
    - Focus: API abuse, resource exhaustion
    - Time: 3 hours

### Phase 8: Remediation Planning (Day 8)

21. **pragmatic-code-wizard**
    - Input: Security findings
    - Output: Fix implementation plan
    - Priority: Critical fixes first
    - Time: 4 hours

22. **microservice-decomposer**
    - Input: Monolith vulnerabilities
    - Output: Security isolation plan
    - Focus: Service boundaries
    - Time: 3 hours

### Phase 9: Security Monitoring Setup (Day 9)

23. **ml-integration-specialist**
    - Input: Security patterns
    - Output: Anomaly detection setup
    - Focus: Behavioral analysis
    - Time: 4 hours

24. **data-pipeline-designer**
    - Input: Security events
    - Output: SIEM pipeline design
    - Focus: Log aggregation, alerts
    - Time: 3 hours

### Phase 10: Documentation & Training (Day 10)

25. **api-doc-generator**
    - Input: Security requirements
    - Output: Security documentation
    - Include: Best practices, examples
    - Time: 3 hours

26. **user-guide-writer**
    - Input: Security features
    - Output: Security user guide
    - Focus: MFA setup, best practices
    - Time: 2 hours

27. **changelog-curator**
    - Input: Security fixes
    - Output: Security changelog
    - Careful: Don't expose details
    - Time: 1 hour

## Security Findings Categories

### Critical (Fix immediately)
- SQL/NoSQL injection vulnerabilities
- Remote code execution risks
- Authentication bypass
- Sensitive data exposure
- Critical dependency vulnerabilities

### High (Fix within 48 hours)
- Cross-site scripting (XSS)
- Insecure direct object references
- Missing authentication
- Weak cryptography
- Security misconfiguration

### Medium (Fix within 1 week)
- Cross-site request forgery
- Using components with known vulnerabilities
- Insufficient logging
- Weak password policies
- Missing rate limiting

### Low (Fix within 1 month)
- Information disclosure
- Missing security headers
- Verbose error messages
- Outdated dependencies
- Documentation issues

## Compliance Checklist

### GDPR Compliance
- [ ] Privacy policy updated
- [ ] Consent mechanisms implemented
- [ ] Right to erasure functionality
- [ ] Data portability features
- [ ] Breach notification process
- [ ] Data minimization verified
- [ ] Purpose limitation checked

### HIPAA Compliance (if applicable)
- [ ] PHI encryption at rest/transit
- [ ] Access controls implemented
- [ ] Audit logging complete
- [ ] Business associate agreements
- [ ] Incident response plan
- [ ] Employee training documented

### SOC2 Compliance
- [ ] Access control procedures
- [ ] Change management process
- [ ] Risk assessment completed
- [ ] Vendor management documented
- [ ] Incident response tested
- [ ] Business continuity plan

## Security Testing Tools Integration

1. **Static Analysis (SAST)**
   - SonarQube configuration
   - Semgrep rules
   - ESLint security plugins

2. **Dynamic Analysis (DAST)**
   - OWASP ZAP integration
   - Burp Suite automation
   - Custom security scripts

3. **Dependency Scanning**
   - Snyk integration
   - GitHub Dependabot
   - npm audit automation

4. **Container Scanning**
   - Trivy implementation
   - Docker Scout
   - Clair integration

## Ongoing Security Measures

1. **Automated Scanning**
   - Daily dependency scans
   - Weekly SAST runs
   - Monthly DAST scans
   - Continuous monitoring

2. **Security Training**
   - Quarterly security workshops
   - Secure coding guidelines
   - Incident response drills
   - Phishing simulations

3. **Incident Response Plan**
   - Detection procedures
   - Containment strategies
   - Eradication steps
   - Recovery processes
   - Lessons learned

## Success Metrics

- ✅ Zero critical vulnerabilities
- ✅ All high vulnerabilities patched
- ✅ 100% API endpoints authenticated
- ✅ Encryption implemented for PII
- ✅ Security headers configured
- ✅ Dependency vulnerabilities < 5
- ✅ Penetration test passed
- ✅ Compliance requirements met
- ✅ Security monitoring active
- ✅ Incident response plan tested

## Security ROI

Investment in security typically prevents:
- Data breach costs ($4.45M average)
- Compliance fines (up to 4% revenue)
- Reputation damage (27% customer loss)
- Business disruption (23 days average)
- Legal costs ($1.5M average)"