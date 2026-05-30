# Feature Development Workflow

## Overview
This workflow orchestrates agents to implement a new feature from concept to production, ensuring quality, security, and performance at every step.

## Workflow Prompt

"Develop a new feature: [FEATURE_NAME] with requirements: [REQUIREMENTS]
Ensure the feature includes:
- Comprehensive testing (unit, integration, E2E)
- Security validation
- Performance benchmarks
- Analytics tracking
- A/B testing capability
- Full documentation
- Mobile optimization

## Agent Execution Sequence

### Phase 1: Planning & Design (Day 1)

1. **feature-request-processor**
   - Input: Feature request from user/PM
   - Output: Detailed PRD with acceptance criteria
   - Next: Task breakdown
   - Time: 2 hours

2. **prd-task-generator**
   - Input: PRD document
   - Output: Granular task list with dependencies
   - Next: API design
   - Time: 1 hour

3. **api-contract-designer**
   - Input: Feature requirements
   - Output: API endpoint specifications
   - Next: Database design
   - Time: 2 hours

4. **database-schema-architect**
   - Input: Data requirements
   - Output: Schema changes, migration scripts
   - Next: Pattern selection
   - Time: 2 hours

5. **design-pattern-advisor**
   - Input: Feature architecture needs
   - Output: Recommended patterns and structure
   - Next: Development
   - Time: 1 hour

### Phase 2: Test-Driven Development (Days 2-3)

6. **tdd-workflow-coach**
   - Input: Feature specifications
   - Output: Test scenarios and TDD guide
   - Next: Implementation
   - Time: 2 hours

7. **strict-feat-orchestrator**
   - Input: Tests and specifications
   - Output: Feature implementation
   - Parallel: Analytics design
   - Time: 8 hours

8. **analytics-event-architect** (Parallel)
   - Input: Feature user flows
   - Output: Analytics event schema
   - Next: Integration
   - Time: 2 hours

### Phase 3: Code Quality & Review (Day 4)

9. **senior-js-engineer** / **strict-react-reviewer**
   - Input: Feature implementation
   - Output: Code review and improvements
   - Next: Security audit
   - Time: 3 hours

10. **efficiency-code-auditor**
    - Input: Reviewed code
    - Output: Performance optimizations
    - Next: Testing
    - Time: 2 hours

11. **backend-security-auditor**
    - Input: API and data flows
    - Output: Security assessment and fixes
    - Next: Testing
    - Time: 3 hours

### Phase 4: Comprehensive Testing (Day 5)

12. **e2e-test-architect**
    - Input: Feature workflows
    - Output: E2E test suite
    - Parallel: Performance testing
    - Time: 4 hours

13. **performance-test-engineer** (Parallel)
    - Input: Feature endpoints
    - Output: Load tests and benchmarks
    - Next: Optimization
    - Time: 3 hours

14. **accessibility-tester**
    - Input: UI components
    - Output: A11y audit and fixes
    - Next: Mobile optimization
    - Time: 2 hours

### Phase 5: Mobile & PWA Optimization (Day 6)

15. **pwa-specialist**
    - Input: Feature components
    - Output: PWA enhancements
    - Parallel: Mobile optimization
    - Time: 3 hours

16. **mobile-performance-optimizer**
    - Input: Mobile implementation
    - Output: Optimized mobile experience
    - Next: Documentation
    - Time: 3 hours

17. **react-native-converter** (if applicable)
    - Input: Web components
    - Output: Native mobile components
    - Next: Documentation
    - Time: 4 hours

### Phase 6: Documentation & Deployment Prep (Day 7)

18. **api-doc-generator**
    - Input: API specifications
    - Output: Updated API docs
    - Parallel: User guide
    - Time: 2 hours

19. **user-guide-writer** (Parallel)
    - Input: Feature functionality
    - Output: User documentation
    - Next: Changelog
    - Time: 3 hours

20. **changelog-curator**
    - Input: Feature changes
    - Output: Release notes
    - Next: CI/CD update
    - Time: 1 hour

### Phase 7: Deployment Pipeline (Day 8)

21. **ci-cd-pipeline-builder**
    - Input: Feature requirements
    - Output: Updated pipelines
    - Next: Cost analysis
    - Time: 2 hours

22. **infrastructure-cost-optimizer**
    - Input: Resource requirements
    - Output: Cost impact analysis
    - Next: A/B setup
    - Time: 2 hours

23. **ml-integration-specialist** (if ML features)
    - Input: Model requirements
    - Output: ML deployment pipeline
    - Next: Feature flags
    - Time: 4 hours

### Phase 8: A/B Testing & Rollout (Day 9)

24. **analytics-event-architect**
    - Input: A/B test requirements
    - Output: Experiment tracking setup
    - Next: Gradual rollout
    - Time: 2 hours

25. **data-pipeline-designer**
    - Input: Analytics requirements
    - Output: Real-time data pipeline
    - Next: Monitoring
    - Time: 3 hours

### Phase 9: Final Review (Day 10)

26. **comedy-code-roaster** (optional)
    - Input: Complete feature
    - Output: Memorable review
    - Next: Team learning
    - Time: 1 hour

27. **feature-implementation-orchestrator**
    - Input: All deliverables
    - Output: Feature completion report
    - Next: Launch
    - Time: 2 hours

## Parallel Execution Matrix

```
Day 1: Planning (Sequential)
Day 2-3: Development + Analytics (Parallel)
Day 4: Reviews (Can parallelize different review types)
Day 5: Testing (E2E and Performance in parallel)
Day 6: Mobile/PWA (Can run simultaneously)
Day 7: Documentation (API and User docs in parallel)
Day 8: Deployment prep
Day 9: A/B testing setup
Day 10: Final review and launch
```

## Success Criteria Checklist

- [ ] Feature PRD approved and tasks defined
- [ ] API contracts designed and reviewed
- [ ] Database migrations tested
- [ ] TDD approach followed (tests written first)
- [ ] Code passes all quality reviews
- [ ] Security vulnerabilities addressed
- [ ] E2E tests cover all user paths
- [ ] Performance meets defined SLAs
- [ ] Accessibility AA compliant
- [ ] Mobile experience optimized
- [ ] Documentation complete
- [ ] Analytics tracking verified
- [ ] A/B test configured
- [ ] CI/CD pipelines updated
- [ ] Cost impact assessed
- [ ] Feature flags configured
- [ ] Rollback plan documented

## Risk Mitigation

- **Blocked by dependencies**: Design pattern advisor helps decouple
- **Performance issues**: Early performance testing catches problems
- **Security vulnerabilities**: Multiple audit points throughout
- **Mobile compatibility**: Dedicated mobile optimization phase
- **Documentation lag**: Parallel documentation creation

## Metrics to Track

1. Development velocity (story points/day)
2. Test coverage percentage
3. Performance benchmark results
4. Security scan results
5. Accessibility score
6. Documentation completeness
7. Time to deployment
8. Post-deployment error rate

## Customization Options

- Skip mobile agents for desktop-only features
- Add domain-specific agents as needed
- Adjust timeline for feature complexity
- Run additional security audits for sensitive features
- Include more user testing phases for UX-critical features"