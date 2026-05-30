# Project Context Gathering and Analysis

## Objective
Gain comprehensive understanding of the project by systematically gathering and analyzing available documentation and project structure.

## Phase 1: Project Structure Discovery

### Step 1: Analyze Project Structure
1. Execute `git ls-files` to get complete file listing
2. If git command fails, use alternative discovery method:
   - List all files recursively from project root
   - Identify file patterns and directory structure
3. **Output**: Create file structure overview

### Step 2: Identify Key Files
Look for and categorize:
- Configuration files (package.json, requirements.txt, etc.)
- Source code directories
- Test directories
- Documentation files
- Build/deployment files

## Phase 2: Documentation Analysis

### Step 1: Read Primary Documentation
1. **README.md Analysis**
   - Read and extract:
     - Project name and description
     - Installation instructions
     - Usage examples
     - Key features
     - Dependencies
   - If missing: Note absence and look for alternative project descriptions

2. **documentation.md Analysis**
   - Read and extract:
     - Architecture overview
     - Technology stack
     - Design philosophy
     - Project goals
   - If missing: Note absence and compile information from other sources

### Step 2: Read Style Guides
1. **coding_style_guide.md Analysis**
   - Read and extract:
     - Coding conventions
     - File naming patterns
     - Code organization principles
     - Best practices
   - If missing: Infer from source code patterns

2. **testing_style_guide.md Analysis**
   - Read and extract:
     - Testing frameworks used
     - Test organization
     - Coverage requirements
     - Testing best practices
   - If missing: Analyze test files directly

## Phase 3: Information Synthesis

### Step 1: Create Comprehensive Summary
Generate `project_context_summary.md` with:

```markdown
# Project Context Summary
Generated: [Current Date/Time]

## Project Overview
- **Name**: [Project name]
- **Type**: [Web app/Library/CLI tool/etc]
- **Primary Language**: [Language]
- **Framework**: [Main framework if applicable]

## Technology Stack
### Languages
- [List languages with approximate percentages]

### Key Dependencies
- [Major dependencies with versions]

### Development Tools
- Build tool: [e.g., webpack, rollup, etc.]
- Package manager: [npm, yarn, pip, etc.]
- Testing framework: [jest, pytest, etc.]

## Architecture Insights
- [High-level architecture description]
- [Key design patterns observed]
- [Project structure philosophy]

## Code Style Summary
### Conventions
- File naming: [Convention observed]
- Function naming: [Convention observed]
- Variable naming: [Convention observed]
- Indentation: [Spaces/tabs, size]

### Best Practices Identified
- [Key best practices from style guide]
- [Patterns observed in codebase]

## Testing Approach
- **Framework**: [Testing framework]
- **Test Types**: [Unit/Integration/E2E]
- **Coverage Goal**: [If specified]
- **Test Structure**: [Pattern observed]

## Development Workflow
- [Installation process]
- [Development commands]
- [Build process]
- [Deployment approach]

## Documentation Completeness
| Document | Status | Key Information |
|----------|--------|-----------------|
| README.md | ✓/✗ | [Key findings] |
| documentation.md | ✓/✗ | [Key findings] |
| coding_style_guide.md | ✓/✗ | [Key findings] |
| testing_style_guide.md | ✓/✗ | [Key findings] |

## Missing Information
- [List gaps in documentation]
- [Areas requiring clarification]
- [Inferred information that needs validation]

## Key Insights
1. [Major insight about the project]
2. [Important patterns or conventions]
3. [Potential areas of concern or complexity]

## Next Steps / Recommendations
- [Suggestions for documentation improvements]
- [Areas needing attention]
- [Questions for project maintainers]
```

### Step 2: Create Quick Reference
Generate `project_quick_reference.md`:

```markdown
# Project Quick Reference

## Essential Commands
```bash
# Install dependencies
[command]

# Run development server
[command]

# Run tests
[command]

# Build for production
[command]
```

## Key File Locations
- Source code: [path]
- Tests: [path]
- Configuration: [path]
- Documentation: [path]

## Important Conventions
- [Key coding convention 1]
- [Key coding convention 2]
- [Key testing convention]

## External Resources
- [Documentation links]
- [Repository links]
- [Related resources]
```

## Phase 4: Validation and Quality Check

### Step 1: Verify Understanding
Create `context_validation.md`:

```markdown
# Context Understanding Validation

## Coverage Checklist
- [ ] Project purpose understood
- [ ] Technology stack identified
- [ ] Code style conventions documented
- [ ] Testing approach clarified
- [ ] Build/deploy process understood
- [ ] Key dependencies noted

## Understanding Confidence
| Area | Confidence | Notes |
|------|------------|-------|
| Architecture | High/Medium/Low | [Explanation] |
| Conventions | High/Medium/Low | [Explanation] |
| Testing | High/Medium/Low | [Explanation] |
| Deployment | High/Medium/Low | [Explanation] |

## Clarification Needed
1. [Question about unclear aspect]
2. [Area needing more information]
3. [Contradiction found in documentation]

## Assumptions Made
- [Assumption 1 with reasoning]
- [Assumption 2 with reasoning]
```

## Phase 5: Error Handling and Reporting

### Error Scenarios and Responses:

1. **Missing Files**
   - Log which files are missing
   - Attempt to infer information from available sources
   - Note limitations in final summary

2. **Incomplete Documentation**
   - Highlight gaps in understanding
   - Suggest specific areas for documentation improvement
   - Provide recommendations for clarification

3. **Contradictory Information**
   - Document conflicting information
   - Attempt to determine most authoritative source
   - Recommend resolution approach

4. **Inaccessible Commands**
   - If `git ls-files` fails, use alternative methods
   - Document workarounds used
   - Note any limitations in discovery

## Completion Checklist

After completing all phases:
- [ ] All available documentation read
- [ ] Project structure analyzed
- [ ] Comprehensive summary created
- [ ] Quick reference guide generated
- [ ] Understanding validated
- [ ] Gaps and assumptions documented
- [ ] Error handling applied where needed

## Expected Output Files
1. `project_context_summary.md` - Comprehensive project understanding
2. `project_quick_reference.md` - Essential information for daily use
3. `context_validation.md` - Understanding verification
4. `context_errors.md` - Issues encountered (if any)

## Success Metrics
- Complete understanding of project structure
- Clear grasp of coding conventions
- Knowledge of testing requirements
- Ability to answer common development questions
- Identification of documentation gaps
- Actionable recommendations for improvement

## Example Usage Scenarios

### Scenario 1: New Team Member Onboarding
Use gathered context to:
- Explain project architecture
- Highlight key conventions
- Identify essential resources
- Provide development quickstart

### Scenario 2: Code Review Preparation
Use context to:
- Apply proper style guidelines
- Verify testing requirements
- Check architectural compliance
- Validate best practices

### Scenario 3: Documentation Improvement
Use findings to:
- Identify documentation gaps
- Suggest content improvements
- Standardize formatting
- Update outdated information
```