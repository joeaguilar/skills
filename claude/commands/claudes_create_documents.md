# Claude AI Project Documentation Generator
> Execute each task sequentially to create comprehensive, standardized documentation for the project.

## Configuration
- **File Naming**: Use lowercase with underscores (e.g., `documentation.md`)
- **Location**: All files at project root unless otherwise specified
- **Format**: Markdown with consistent headers and structure
- **Error Policy**: Document any errors in `documentation_errors.md`

## Task 1: Project Discovery and Understanding
**Objective**: Gather comprehensive project context

### Discovery Steps:
1. Read `README.md` if present
2. Execute `git ls-files` to list all project files
3. Analyze project structure and file patterns
4. Identify main programming language(s)
5. Detect package managers and configuration files
6. Identify testing frameworks if present
7. Check for CI/CD configurations

### Error Handling:
- If `README.md` missing: Note this and continue with other discovery methods
- If `git ls-files` fails: Use alternative discovery methods (file system analysis)
- Document all discovery limitations

### Output:
Create `project_discovery.md` with:
```markdown
# Project Discovery Report
Date: [Current Date]

## Project Structure
- Language(s): [Detected languages]
- Frameworks: [Detected frameworks]
- Package Manager: [npm/yarn/pip/etc]
- Testing Framework: [Detected testing tools]

## File Analysis
- Total files: [Count]
- Key directories: [List main directories]
- Configuration files: [List config files]

## Architecture Insights
- Project type: [Web app/Library/CLI/etc]
- Build tools: [Detected build tools]
- Dependencies: [Major dependencies]

## Discovery Limitations
- [List any files/information that couldn't be accessed]
```

## Task 2: Create Project Documentation
**Objective**: Generate comprehensive project overview

### Create `documentation.md`:

```markdown
# Project Documentation

## Project Overview
- **Name**: [Project name]
- **Version**: [Version if detected]
- **Description**: [Project purpose and goals]
- **Type**: [Application/Library/Tool/etc]

## Architecture
### System Design
- [High-level architecture description]
- [Key components and their interactions]
- [Data flow patterns]

### Technology Stack
#### Languages
- [Programming languages with versions]

#### Frameworks & Libraries
- [Frontend frameworks]
- [Backend frameworks]
- [Key libraries with versions]

#### Tools & Services
- [Build tools]
- [CI/CD platforms]
- [Deployment platforms]
- [Monitoring tools]

## Getting Started
### Prerequisites
- [System requirements]
- [Required software versions]

### Installation
1. [Step-by-step installation]
2. [Environment setup]
3. [Configuration steps]

### Quick Start
- [Basic usage example]
- [Common commands]

## Project Structure
```
[Directory tree visualization]
```

## Key Components
### [Component 1]
- Purpose: [Description]
- Location: [File path]
- Dependencies: [List dependencies]

### [Component 2]
- Purpose: [Description]
- Location: [File path]
- Dependencies: [List dependencies]

## Configuration
- [Configuration files explanation]
- [Environment variables]
- [Default settings]

## External Dependencies
| Dependency | Version | Purpose | License |
|------------|---------|---------|---------|
| [name] | [version] | [purpose] | [license] |

## Deployment
- [Deployment process]
- [Environment requirements]
- [Build steps]

## Maintenance
- [Update procedures]
- [Backup recommendations]
- [Troubleshooting common issues]
```

## Task 3: Create Coding Style Guide
**Objective**: Document coding standards and conventions

### Create `coding_style_guide.md`:

```markdown
# Coding Style Guide

## Language Standards
### [Primary Language]
- Version: [Required version]
- Style Guide: [Link to official style guide if applicable]

## Code Organization
### File Structure
- [Naming conventions]
- [Directory organization]
- [Import/export patterns]

### Naming Conventions
- Variables: [Convention and examples]
- Functions: [Convention and examples]
- Classes: [Convention and examples]
- Constants: [Convention and examples]
- Files: [Convention and examples]

## Code Style
### Formatting
- Indentation: [Spaces/tabs, size]
- Line length: [Max characters]
- Quotes: [Single/double]
- Semicolons: [Required/optional]

### Comments
- Function documentation: [Format and requirements]
- Inline comments: [Best practices]
- File headers: [Template if required]

### Error Handling
- Exception patterns: [How to handle errors]
- Logging standards: [Logging levels and format]
- Validation approaches: [Input validation standards]

## Best Practices
### Performance
- [Performance considerations]
- [Memory management guidelines]
- [Async patterns]

### Security
- [Security best practices]
- [Input sanitization]
- [Authentication patterns]

### Maintainability
- [Code organization principles]
- [Refactoring guidelines]
- [Documentation requirements]

## Code Review Standards
- [Review checklist]
- [Review process]
- [Approval requirements]

## Tools and Linters
- [Code formatters with configuration]
- [Linters with rules]
- [Static analysis tools]

## Design Philosophy
- [Core design principles]
- [Architecture patterns]
- [Code reusability guidelines]

## Example Code
```[language]
// Example demonstrating style guidelines
class ExampleClass {
    constructor(param) {
        this.property = param;
    }
    
    method() {
        // Method implementation
    }
}
```

## Common Patterns
- [Design patterns used in the project]
- [Implementation examples]
- [When to use each pattern]
```

## Task 4: Create Testing Style Guide
**Objective**: Define testing standards and practices

### Create `testing_style_guide.md`:

```markdown
# Testing Style Guide

## Testing Philosophy
- [Testing approach: TDD/BDD/etc]
- [Coverage requirements]
- [Testing pyramid strategy]

## Test Organization
### Directory Structure
```
tests/
├── unit/
├── integration/
├── e2e/
└── fixtures/
```

### File Naming
- Unit tests: [Convention]
- Integration tests: [Convention]
- E2E tests: [Convention]
- Test fixtures: [Convention]

## Unit Testing
### Framework: [Framework Name]
- Version: [Version]
- Documentation: [Link]

### Unit Test Structure
```[language]
describe('ComponentName', () => {
    describe('methodName', () => {
        it('should [expected behavior]', () => {
            // Arrange
            const expected = 'result';
            
            // Act
            const actual = component.method();
            
            // Assert
            expect(actual).toBe(expected);
        });
    });
});
```

### Best Practices
- [Test naming conventions]
- [Setup and teardown patterns]
- [Mocking strategies]
- [Assertion patterns]

## Integration Testing
### Scope
- [What constitutes an integration test]
- [Test data management]
- [Database testing approaches]

### Example Structure
```[language]
// Integration test example
```

## End-to-End Testing
### Framework: [Framework Name]
- [E2E testing approach]
- [Browser/environment support]
- [Test data strategies]

## Code Coverage
### Requirements
- Minimum coverage: [Percentage]
- Coverage tools: [Tools used]
- Exclusions: [What files to exclude]

### Reporting
- [Coverage report generation]
- [CI integration]

## Test Data Management
- [Test data creation patterns]
- [Data cleanup strategies]
- [Fixture management]

## Performance Testing
- [Performance test types]
- [Benchmarking approaches]
- [Load testing standards]

## Testing CI/CD Integration
- [Automated test execution]
- [Test result reporting]
- [Failure handling]

## Mocking and Stubs
- [Mocking libraries]
- [When to mock vs integration test]
- [Mock data patterns]

## Debugging Tests
- [Debugging tools]
- [Common debugging patterns]
- [Troubleshooting failing tests]
```

## Task 5: Create API Documentation (if applicable)
**Objective**: Document API endpoints and usage

### Create `api_documentation.md`:

```markdown
# API Documentation

## Base URL
```
[Base URL]
```

## Authentication
- [Authentication method]
- [Required headers]
- [Token format]

## Endpoints

### [Endpoint Category]

#### GET /api/resource
- **Description**: [Purpose]
- **Parameters**:
  | Parameter | Type | Required | Description |
  |-----------|------|----------|-------------|
  | [param] | [type] | [yes/no] | [description] |

- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      // Response structure
    }
  }
  ```

- **Status Codes**:
  - 200: Success
  - 400: Bad Request
  - 401: Unauthorized
  - 404: Not Found

## Error Handling
- [Error response format]
- [Common error codes]
- [Error message structure]

## Rate Limiting
- [Rate limit policy]
- [Headers for rate limiting]

## Versioning
- [API versioning strategy]
- [Deprecation policy]
```

## Task 6: Create Deployment Guide
**Objective**: Document deployment procedures

### Create `deployment_guide.md`:

```markdown
# Deployment Guide

## Environments
- Development: [Details]
- Staging: [Details]
- Production: [Details]

## Prerequisites
- [Required access]
- [Tools needed]
- [Environment variables]

## Build Process
1. [Step-by-step build instructions]
2. [Asset compilation]
3. [Optimization steps]

## Deployment Steps
### To Staging
1. [Step 1]
2. [Step 2]
3. [Verification steps]

### To Production
1. [Step 1]
2. [Step 2]
3. [Smoke tests]
4. [Monitoring checks]

## Rollback Procedures
- [When to rollback]
- [Rollback steps]
- [Data considerations]

## Post-Deployment
- [Health checks]
- [Performance monitoring]
- [Log verification]

## Troubleshooting
| Issue | Solution |
|-------|----------|
| [Common issue] | [Resolution] |
```

## Task 7: Create CLAUDE.md
**Objective**: Create reference for future AI iterations

### Create `claude.md`:

```markdown
# CLAUDE.md - AI Assistant Reference

## Project Overview
- **Last Updated**: [Date]
- **Project Name**: [Name]
- **Project Type**: [Type]
- **Main Language**: [Language]

## Documentation Files Created
- [x] documentation.md
- [x] coding_style_guide.md
- [x] testing_style_guide.md
- [x] api_documentation.md (if applicable)
- [x] deployment_guide.md
- [x] project_discovery.md

## Key Project Characteristics
### Architecture
- [Brief architecture description]
- [Key patterns used]

### Technologies
- [Primary tech stack]
- [Build/deployment tools]

### Code Conventions
- [Key style points]
- [Important patterns]

### Testing Approach
- [Testing frameworks]
- [Coverage requirements]

## Common Commands
```bash
# Installation
[install command]

# Development
[dev command]

# Testing
[test command]

# Build
[build command]

# Deployment
[deploy command]
```

## Important Notes for Future Iterations
1. [Key gotchas to remember]
2. [Special considerations]
3. [Common troubleshooting issues]

## Code Examples for AI Reference
### [Common Pattern 1]
```[language]
// Example code
```

### [Common Pattern 2]
```[language]
// Example code
```

## Project-Specific Instructions
- [Special handling required]
- [Project-specific workflows]
- [Integration points]

## Update Instructions
When updating this project:
1. [Step 1]
2. [Step 2]
3. [Verification steps]

## Resources
- Documentation: [Links]
- Issue tracking: [Link]
- CI/CD: [Link]
- Deployment: [Link]

---
*This file was generated by Claude AI to assist future iterations in understanding and working with this project.*
```

## Final Validation
After completing all tasks:

1. **File Verification**:
   - [ ] All required files created
   - [ ] Files properly formatted
   - [ ] No naming convention violations

2. **Content Quality**:
   - [ ] All sections completed
   - [ ] Code examples included where appropriate
   - [ ] Links and references valid

3. **Cross-References**:
   - [ ] Consistent terminology across files
   - [ ] Proper linking between documents
   - [ ] No contradictory information

4. **Error Reporting**:
   - [ ] Create `documentation_errors.md` if any issues encountered
   - [ ] Document workarounds for missing information
   - [ ] Note areas requiring manual review

## Completion Summary
Create `documentation_summary.md`:

```markdown
# Documentation Generation Summary

## Files Created
- [x] project_discovery.md
- [x] documentation.md
- [x] coding_style_guide.md
- [x] testing_style_guide.md
- [x] api_documentation.md (if applicable)
- [x] deployment_guide.md
- [x] claude.md

## Discovery Results
- Languages: [List]
- Frameworks: [List]
- Build tools: [List]

## Manual Review Required
- [List items needing human review]
- [Incomplete sections]
- [Assumptions made]

## Next Steps
1. [Review generated documentation]
2. [Fill in manual requirements]
3. [Update CI/CD with new docs]
```

## Example Output Structure
```
project-root/
├── README.md (existing)
├── documentation.md
├── coding_style_guide.md
├── testing_style_guide.md
├── api_documentation.md
├── deployment_guide.md
├── claude.md
├── project_discovery.md
├── documentation_summary.md
└── documentation_errors.md (if needed)
```