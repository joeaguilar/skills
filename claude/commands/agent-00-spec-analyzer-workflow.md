# Spec Analyzer Workflow

## Overview
This workflow demonstrates how the Spec Analyzer to Workflow Architect agent operates to analyze user requirements and create comprehensive agent-based workflows for any type of application.

## Workflow Execution

### Step 1: Initial Request Analysis
**User Input**: "I want to build an app that [description]"

**Agent Actions**:
1. Parse request for initial indicators
2. Identify potential project type
3. Web search for similar projects and best practices
4. Query Context7 for relevant framework documentation

### Step 2: Agent Inventory Retrieval
**Agent retrieves full list of available agents**:
- Planning & Requirements Agents (3)
- Development Process Agents (6)
- Code Review & Quality Agents (4)
- Analysis & Optimization Agents (2)
- API & Backend Agents (3)
- Testing Specialists (3)
- DevOps & Infrastructure (3)
- Documentation & Communication (3)
- Architecture & Design (3)
- Data & Analytics (3)
- Mobile & Cross-Platform (3)
- Utility Agents (1)

### Step 3: Comprehensive Questioning Phase

**Agent presents clarifying questions organized by category**:

```markdown
## Project Clarification Questions

To design the optimal workflow for your project, I need to understand your requirements in detail. Please answer the following questions:

### 1. Project Foundation
- [ ] What type of application? (Web app, Mobile app, Desktop app, API service, CLI tool)
- [ ] What is the primary purpose? (E-commerce, Social, SaaS, Internal tool, etc.)
- [ ] Who is your target audience? (Consumers, Businesses, Developers, etc.)
- [ ] Starting fresh or migrating existing code?
- [ ] Timeline expectations? (MVP in weeks, Production in months)
- [ ] Team size and expertise level?

### 2. Technical Preferences
- [ ] Preferred programming language(s)?
- [ ] Frontend framework preference? (React, Vue, Angular, etc.)
- [ ] Backend framework preference? (Express, Django, Spring, etc.)
- [ ] Database preference? (PostgreSQL, MongoDB, etc.)
- [ ] Cloud provider? (AWS, Azure, GCP, Self-hosted)

### 3. Scale & Performance
- [ ] Expected user count? (Hundreds to Millions)
- [ ] Geographic distribution? (Single region or Global)
- [ ] Real-time features needed? (Chat, Notifications, Live updates)
- [ ] Performance targets? (Load time, Response time)
- [ ] Offline functionality required?

### 4. Security & Compliance
- [ ] Handling sensitive data? (Personal, Financial, Health)
- [ ] Compliance requirements? (GDPR, HIPAA, PCI-DSS, SOC2)
- [ ] Authentication complexity? (Simple login, SSO, MFA)
- [ ] Data encryption needs?
- [ ] Audit trail requirements?

### 5. Features & Integrations
- [ ] Payment processing needed?
- [ ] Email/SMS capabilities?
- [ ] File upload/storage requirements?
- [ ] Third-party API integrations?
- [ ] Analytics and reporting needs?
- [ ] Machine learning features?

### 6. Development Practices
- [ ] Testing coverage expectations? (Unit, Integration, E2E)
- [ ] CI/CD automation desired?
- [ ] Documentation standards?
- [ ] Code review process?
- [ ] Monitoring and alerting needs?

### 7. Special Requirements
- [ ] Multi-tenancy needed?
- [ ] Internationalization (i18n)?
- [ ] Accessibility standards? (WCAG AA/AAA)
- [ ] SEO requirements?
- [ ] Mobile app needed alongside web?
- [ ] Progressive Web App features?
```

### Step 4: Requirements Analysis & Research

**Agent performs deep analysis**:
1. **Web Search**:
   - Best practices for identified project type
   - Common pitfalls and solutions
   - Latest technology recommendations
   - Security considerations

2. **Context7 Research**:
   - Framework-specific documentation
   - Code examples and patterns
   - Performance optimization guides
   - Integration strategies

3. **Chain of Thought Reasoning**:
   - Evaluate trade-offs between options
   - Consider long-term maintainability
   - Assess scalability implications
   - Calculate resource requirements

### Step 5: Workflow Design

**Agent creates optimal workflow considering**:
- User's answers to clarifying questions
- Best practices from research
- Available agent capabilities
- Parallel execution opportunities
- Risk mitigation strategies
- Timeline and budget constraints

### Step 6: Generate project_spec.md

**Example Output**:

```markdown
# Project Specification: E-Commerce Marketplace

## Executive Summary
Building a modern e-commerce marketplace with React/Next.js frontend, Node.js backend, PostgreSQL database, and microservices architecture. The platform will support 100K+ users with real-time inventory updates, secure payment processing, and mobile-responsive design.

## Project Requirements

### Functional Requirements
- User registration and authentication with OAuth
- Product catalog with search and filtering
- Shopping cart and checkout process
- Payment processing (Stripe integration)
- Order management and tracking
- Seller dashboard and inventory management
- Review and rating system
- Real-time notifications

### Non-Functional Requirements
- Page load time < 2 seconds
- 99.9% uptime SLA
- PCI-DSS compliance for payments
- GDPR compliance for EU users
- Mobile-first responsive design
- SEO optimized
- Accessible (WCAG AA)

## Technology Stack

### Frontend
- Framework: Next.js 14 (App Router)
  - Justification: SEO benefits, SSR/SSG capabilities, excellent DX
- State Management: Zustand + React Query
  - Justification: Lightweight, powerful data fetching
- UI Components: Tailwind CSS + Radix UI
  - Justification: Rapid development, accessible components

### Backend
- Language: TypeScript/Node.js
  - Justification: Shared language with frontend, large ecosystem
- Framework: Express + Apollo GraphQL
  - Justification: Flexible, great for complex data requirements
- Database: PostgreSQL + Redis
  - Justification: ACID compliance, caching layer

### Infrastructure
- Cloud Provider: AWS
  - Services: ECS, RDS, ElastiCache, S3, CloudFront
- Container Strategy: Docker + Kubernetes
- CI/CD: GitHub Actions

## Agent Workflow Orchestration

### Phase 1: Project Initialization (Days 1-3)
1. **spec-analyzer-workflow-architect**: Refine requirements
   - Input: This specification
   - Output: Detailed technical requirements
   - Time: 2 hours

2. **feature-request-processor**: Create comprehensive PRD
   - Input: Business requirements
   - Output: Product requirements document
   - Time: 4 hours

3. **prd-task-generator**: Generate task breakdown
   - Input: PRD
   - Output: Detailed task list
   - Time: 2 hours

4. **api-contract-designer**: Design GraphQL schema
   - Input: Data requirements
   - Output: Complete API specification
   - Time: 6 hours

5. **database-schema-architect**: Design database
   - Input: Data model requirements
   - Output: PostgreSQL schema, migrations
   - Time: 6 hours

### Phase 2: Infrastructure Setup (Days 4-5)
[Parallel Execution Block 1]
6. **docker-compose-architect**: Local development environment
7. **ci-cd-pipeline-builder**: GitHub Actions workflows
8. **infrastructure-cost-optimizer**: AWS cost analysis

### Phase 3: Core Development (Days 6-15)
[Multiple agents working in parallel on different features]
- Authentication system
- Product catalog
- Shopping cart
- Payment integration
- Order management

### Phase 4: Quality Assurance (Days 16-18)
[Comprehensive testing and security phase]

### Phase 5: Deployment Preparation (Days 19-20)
[Production readiness and documentation]

## Risk Mitigation
- Payment processing: Implement idempotency, webhook retries
- Scalability: Design for horizontal scaling from day one
- Security: Regular dependency updates, security scanning
- Data loss: Automated backups, disaster recovery plan

## Success Metrics
- Page load time < 2s (measured by Lighthouse)
- API response time < 200ms (p95)
- 99.9% uptime achieved
- Zero critical security vulnerabilities
- 80%+ code coverage
- Mobile performance score > 90

## Timeline Estimate
- Total duration: 20 days
- MVP ready: Day 15
- Production ready: Day 20
- Post-launch optimization: Ongoing

## Cost Considerations
- AWS infrastructure: ~$500/month initially
- Scaling to 100K users: ~$2000/month
- Third-party services: ~$300/month
- Suggested optimizations to reduce costs by 30%

## Future Considerations
- Mobile app development (React Native)
- AI-powered recommendations
- International expansion
- Marketplace analytics platform
- Seller API program
```

### Step 7: Workflow Validation

**Agent performs final checks**:
1. All requirements addressed
2. Agent assignments logical
3. Timeline realistic
4. Dependencies identified
5. Parallel execution optimized
6. Risks mitigated
7. Budget aligned

## Benefits of This Approach

1. **Comprehensive Coverage**: No aspect overlooked
2. **Best Practices**: Incorporates latest industry standards
3. **Efficient Execution**: Optimized parallel workflows
4. **Risk Reduction**: Issues identified early
5. **Clear Communication**: Detailed documentation
6. **Flexibility**: Adaptable to any project type
7. **Learning Opportunity**: Educates users about options

## Usage Example

```bash
User: "I want to build a fitness tracking app"

Spec Analyzer: "I'll help you design the perfect workflow for your fitness tracking app. Let me start by understanding your specific needs..."

[Presents organized questions]

[User provides answers]

Spec Analyzer: "Based on your requirements, I've researched best practices for fitness apps and designed a comprehensive workflow using our specialized agents. Here's your project specification..."

[Generates detailed project_spec.md]
```

This workflow ensures every project starts with the strongest possible foundation, leveraging all available agents optimally.