# Initialize Project Workflow

## Overview
This workflow orchestrates all agents to set up a complete production-ready project from scratch, including all infrastructure, testing, security, monitoring, and deployment pipelines.

## Workflow Prompt

"Initialize a new [PROJECT_TYPE] project with name [PROJECT_NAME] that includes:
- Full test suite (unit, integration, E2E)
- Security scanning and compliance
- CI/CD pipelines with staging and production
- Analytics and monitoring
- A/B testing capabilities
- Performance optimization
- Documentation
- Mobile readiness

## Agent Execution Sequence

### Phase 1: Requirements & Architecture (Days 1-2)

1. **feature-request-processor**
   - Input: Initial project requirements
   - Output: Comprehensive PRD with technical specifications
   - Triggers: Creates foundational documentation

2. **prd-task-generator**
   - Input: PRD from previous step
   - Output: Detailed task list for implementation
   - Triggers: Task tracking system setup

3. **api-contract-designer**
   - Input: PRD and technical requirements
   - Output: OpenAPI specifications, GraphQL schemas
   - Triggers: API-first development approach

4. **database-schema-architect**
   - Input: Data requirements from PRD
   - Output: Optimized database schemas, migration scripts
   - Triggers: Database initialization

### Phase 2: Development Environment (Day 3)

5. **docker-compose-architect**
   - Input: Technology stack requirements
   - Output: Complete Docker Compose setup
   - Triggers: Local development environment

6. **dependency-analyzer**
   - Input: Technology choices
   - Output: Optimized dependency tree, security audit
   - Triggers: Package installation

7. **design-pattern-advisor**
   - Input: Architecture requirements
   - Output: Recommended patterns and implementation guides
   - Triggers: Code structure setup

### Phase 3: Core Implementation (Days 4-7)

8. **tdd-workflow-coach**
   - Input: Feature requirements
   - Output: TDD implementation guide
   - Triggers: Test-first development

9. **strict-feat-orchestrator**
   - Input: Task list and requirements
   - Output: Quality-controlled feature implementation
   - Triggers: Core feature development

10. **pragmatic-code-wizard**
    - Input: Complex implementation challenges
    - Output: Solutions and optimizations
    - Triggers: Problem solving

### Phase 4: Testing Infrastructure (Days 8-9)

11. **e2e-test-architect**
    - Input: User journeys from PRD
    - Output: Comprehensive E2E test suite
    - Triggers: E2E test implementation

12. **performance-test-engineer**
    - Input: Performance requirements
    - Output: Load testing scripts and benchmarks
    - Triggers: Performance baseline

13. **accessibility-tester**
    - Input: UI components and workflows
    - Output: Accessibility audit and fixes
    - Triggers: A11y compliance

### Phase 5: Security & Compliance (Day 10)

14. **backend-security-auditor**
    - Input: API endpoints and authentication flows
    - Output: Security audit report and fixes
    - Triggers: Security hardening

15. **cpp-code-reviewer** (if applicable)
    - Input: Native code components
    - Output: Performance and security review
    - Triggers: Native code optimization

### Phase 6: Analytics & Monitoring (Day 11)

16. **analytics-event-architect**
    - Input: Business KPIs and user journeys
    - Output: Complete analytics implementation
    - Triggers: Analytics integration

17. **data-pipeline-designer**
    - Input: Data flow requirements
    - Output: ETL/streaming pipelines
    - Triggers: Data infrastructure

### Phase 7: CI/CD & Deployment (Day 12)

18. **ci-cd-pipeline-builder**
    - Input: Deployment requirements
    - Output: Complete CI/CD pipelines
    - Triggers: Automated deployment

19. **infrastructure-cost-optimizer**
    - Input: Infrastructure setup
    - Output: Cost optimization recommendations
    - Triggers: Budget-aware deployment

### Phase 8: Documentation (Day 13)

20. **api-doc-generator**
    - Input: API specifications
    - Output: Interactive API documentation
    - Triggers: Developer portal

21. **user-guide-writer**
    - Input: Feature implementations
    - Output: User documentation
    - Triggers: Help system

22. **changelog-curator**
    - Input: Initial release features
    - Output: Version 1.0 changelog
    - Triggers: Release notes

### Phase 9: Mobile & PWA (Day 14)

23. **pwa-specialist**
    - Input: Web application
    - Output: PWA implementation
    - Triggers: Offline capabilities

24. **react-native-converter** (if applicable)
    - Input: React web components
    - Output: React Native app structure
    - Triggers: Mobile app creation

25. **mobile-performance-optimizer**
    - Input: Mobile implementations
    - Output: Optimized mobile experience
    - Triggers: Mobile deployment

### Phase 10: ML & Advanced Features (Day 15)

26. **ml-integration-specialist** (if applicable)
    - Input: ML model requirements
    - Output: Production ML pipeline
    - Triggers: AI features

27. **microservice-decomposer** (for scaling prep)
    - Input: Monolithic structure
    - Output: Microservice migration plan
    - Triggers: Future scaling strategy

### Phase 11: Quality Assurance (Days 16-17)

28. **strict-react-reviewer** / **senior-js-engineer**
    - Input: Complete codebase
    - Output: Code quality audit
    - Triggers: Quality improvements

29. **efficiency-code-auditor**
    - Input: Full implementation
    - Output: Efficiency audit and optimizations
    - Triggers: Performance improvements

30. **comedy-code-roaster** (optional)
    - Input: Code review findings
    - Output: Memorable lessons through humor
    - Triggers: Team learning

### Phase 12: Launch Preparation (Day 18)

31. **feature-implementation-orchestrator**
    - Input: Final feature checklist
    - Output: Launch readiness report
    - Triggers: Go-live decision

32. **emoji-translator-pro**
    - Input: Launch announcement
    - Output: Social media ready content
    - Triggers: Marketing material

## Success Criteria

- ✅ All tests passing (unit, integration, E2E)
- ✅ Security scan shows no high/critical vulnerabilities
- ✅ Performance benchmarks meet requirements
- ✅ Accessibility WCAG 2.1 AA compliant
- ✅ CI/CD pipelines deploy successfully
- ✅ Documentation complete and reviewed
- ✅ Analytics tracking verified
- ✅ A/B testing framework operational
- ✅ Mobile/PWA experience optimized
- ✅ Cost projections within budget

## Parallel Execution Opportunities

Several agent tasks can run in parallel:
- Documentation agents while implementation continues
- Security scanning while testing develops
- Mobile optimization while web features complete
- Analytics setup while core features develop

## Customization Points

- Skip mobile agents for desktop-only applications
- Skip ML agents for non-AI projects
- Add specialized agents for industry-specific needs
- Adjust timeline based on project complexity

## Output Artifacts

1. Fully functional application with all features
2. Complete test suite with >80% coverage
3. CI/CD pipelines for all environments
4. Comprehensive documentation suite
5. Security audit reports and compliance docs
6. Performance benchmarks and optimization reports
7. Analytics dashboards and tracking
8. Mobile applications (if applicable)
9. Infrastructure as code definitions
10. Operational runbooks and guides"