# Claude AI Feature Request Processing System
> Execute each task sequentially to capture and transform user input into a comprehensive Product Requirements Document (PRD).

## Instructions Overview
Follow these 7 tasks in order. If any step encounters an error or missing information, note it and proceed with available data while flagging the issue.

## Task 1: Gain Context Understanding
**Objective**: Understand the project context

1. Read `README.md` from the project root
2. Read `documentation.md` for detailed project understanding
3. If either file is missing or incomplete:
   - Note the missing information
   - Proceed with available context
   - Flag this limitation in all subsequent outputs

**Output**: Internal understanding (no file creation required)

## Task 2: Create Planning Directory Structure
**Objective**: Set up organized workspace

1. Create `/planning` directory at project root if it doesn't exist
2. Ensure proper permissions for file creation
3. Verify successful creation

**Output**: Confirm directory creation or note if it already exists

## Task 3: Process and Validate User Request
**Objective**: Analyze and validate the feature request

### Input Processing:
```
<user_request>
$ARGUMENTS
</user_request>
```

### Actions:
1. Parse the user request for clarity and completeness
2. Identify any ambiguous or missing elements
3. Generate clarifying questions if needed
4. Classify the request type (feature, bug fix, enhancement, etc.)
5. Extract key requirements and user goals

**Output**: Validated and clarified feature request

## Task 4: Create Initial Documentation
**Objective**: Document the request systematically

### Actions:
1. Create a concise summary of the user request (max 500 words)
2. Generate a shortname for the request (kebab-case, max 30 characters)
3. Create directory: `/planning/{shortname}/`
4. Save files:
   - `request.md`: Original user request
   - `summary.md`: Processed summary with key points
   - Include metadata: date, request ID, classification

**File Structure Example**:
```
/planning/
  ├── new-dashboard-widget/
  │   ├── request.md
  │   └── summary.md
```

## Task 5: Create Implementation Plan
**Objective**: Develop detailed implementation strategy

### Create `plan.md` with:
1. **Feature Overview**: High-level description
2. **Technical Approach**: Implementation strategy
3. **Dependencies**: Required components and libraries
4. **Cross-References**: Related documentation and code
5. **Implementation Steps**: Ordered list of development tasks
6. **Integration Points**: How this connects with existing systems

### Best Practices:
- Reference specific code files and functions
- Include architectural considerations
- Plan for backwards compatibility
- Consider scalability implications

## Task 6: Create Product Requirements Document
**Objective**: Generate comprehensive PRD for engineering implementation

### Create `prd.md` following this template:

```markdown
# Feature Name: [Title]
Date: [Current Date]
Request ID: [Generated ID]

## Executive Summary
[Brief overview of the feature]

## Requirements

### Functional Requirements
- [List specific feature capabilities]
- [Input/output specifications]
- [User interaction flows]

### Technical Requirements
- [System integration points]
- [Performance requirements]
- [Security considerations]

### Acceptance Criteria
- [ ] [Specific testable conditions]
- [ ] [User experience benchmarks]
- [ ] [Performance metrics]

## Testing Plan
### Unit Tests
- [Component-level test scenarios]
- [Mock requirements]
- [Edge case handling]

### Integration Tests
- [System interaction tests]
- [API endpoint validation]
- [Database interaction tests]

### User Acceptance Tests
- [End-to-end workflows]
- [Browser compatibility]
- [Accessibility compliance]

## Implementation Approach
### Optimal Architecture
- [Recommended design patterns]
- [Component structure]
- [Data flow architecture]

### Implementation Details
1. [Step-by-step implementation guide]
2. [Code structure recommendations]
3. [Best practices and patterns]

### Integration Strategy
- [How to integrate with existing codebase]
- [Migration steps if needed]
- [Rollback procedures]

## Best Practices Guide
- [Security best practices]
- [Performance optimization tips]
- [Code review guidelines]
- [Documentation requirements]

## Success Metrics
- [KPIs to measure success]
- [Performance benchmarks]
- [User satisfaction indicators]
```

### Requirements:
- **MUST INCLUDE**: Testing plan, optimal implementation, best practices guide
- **DO NOT INCLUDE**: Team estimates, cost factors, implementation timelines

## Task 7: Create Risk Assessment
**Objective**: Identify and document potential risks

### Create `risks.md` with risk assessment table:

| Risk Category | Description | Severity | Mitigation Strategy |
|--------------|-------------|----------|-------------------|
| Security | [Specific security concern] | 🔴 | [Prevention approach] |
| Dependencies | [Library/version issues] | 🟡 | [Alternative options] |
| Performance | [Potential bottlenecks] | 🟢 | [Optimization plan] |

### Severity Scale:
- 🔴 High Risk: Immediate attention required
- 🟡 Medium Risk: Plan mitigation before implementation
- 🟢 Low Risk: Monitor during development
- ⚪ Informational: For awareness only

### Risk Categories to Assess:
1. **Security Risks**
   - Vulnerable dependencies
   - Data exposure potential
   - Authentication/authorization gaps
   - Code injection vulnerabilities (eval, etc.)

2. **Technical Risks**
   - Outdated libraries
   - Breaking changes
   - Performance bottlenecks
   - Scalability concerns

3. **Integration Risks**
   - Compatibility issues
   - API breaking changes
   - Database schema conflicts
   - Third-party service dependencies

4. **Operational Risks**
   - Deployment complexity
   - Rollback procedures
   - Monitoring requirements
   - Documentation gaps

## Final Validation
After completing all tasks:
1. Review all created files for completeness
2. Ensure cross-references are accurate
3. Verify that all requirements are captured
4. Confirm that the PRD addresses the original user request

## Error Handling
If any step fails:
1. Document the failure in `errors.md`
2. Include timestamp and error details
3. Suggest alternative approaches
4. Continue with remaining tasks when possible

## Example Output Structure
```
/planning/
  ├── dashboard-widget-feature/
  │   ├── request.md
  │   ├── summary.md
  │   ├── plan.md
  │   ├── prd.md
  │   ├── risks.md
  │   └── errors.md (if applicable)
```

## Completion Checklist
- [ ] README.md and documentation.md reviewed
- [ ] Planning directory created
- [ ] User request processed and clarified
- [ ] All required files created
- [ ] PRD includes all mandatory sections
- [ ] Risk assessment completed
- [ ] All files are properly formatted
- [ ] Cross-references verified