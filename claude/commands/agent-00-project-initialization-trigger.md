# Project Initialization Trigger Workflow

## Overview
This workflow triggers the Spec Analyzer to Workflow Architect agent when a user wants to start a new project. It provides a simple entry point that automatically engages the comprehensive requirements gathering process.

## Trigger Commands

Users can initiate this workflow with any of these phrases:
- "I want to build..."
- "Help me create..."
- "I need to develop..."
- "Can you scaffold..."
- "Initialize a new..."
- "Start a project for..."
- "@init [project description]"
- "@scaffold [project type]"
- "@new [application name]"

## Workflow Execution

### Step 1: Trigger Detection
```yaml
trigger:
  patterns:
    - "build|create|develop|scaffold|initialize|start project|new app"
  action: "launch_spec_analyzer"
```

### Step 2: Launch Spec Analyzer

**Immediate Response**:
```markdown
🚀 **Project Initialization Started**

I'm your Spec Analyzer architect, and I'll help you design the perfect development workflow for your project. 

To create a comprehensive plan that leverages all our specialized agents effectively, I need to understand your project in detail.

Let me analyze your request and prepare some questions...
```

### Step 3: Initial Analysis Phase

**Agent Actions**:
1. Parse the user's initial request
2. Identify project type indicators
3. Web search for similar projects
4. Query Context7 for relevant frameworks
5. Prepare tailored questions

**Response after 10 seconds**:
```markdown
📋 **Initial Analysis Complete**

Based on your request to [summarized request], I've identified this as potentially a [project type] project.

I've researched current best practices and will now ask you some detailed questions to ensure we build your project with the optimal architecture and workflow.
```

### Step 4: Present Clarifying Questions

**Structured Question Presentation**:
```markdown
## 🎯 Project Requirements Discovery

I'll ask questions in several categories. You can answer all at once or we can go through them step by step.

**Would you prefer:**
1. 📝 Answer all questions at once (I'll show you the complete list)
2. 🗣️ Interactive mode (I'll ask one category at a time)
3. ⚡ Quick start (minimal questions, we'll refine as we go)

Please type 1, 2, or 3:
```

### Option 1: Complete Questionnaire
```markdown
## Complete Project Questionnaire

Please answer as many questions as you can. Skip any that don't apply or you're unsure about.

### 📦 Project Foundation
1. What type of application are you building?
   - [ ] Web application
   - [ ] Mobile application  
   - [ ] Desktop application
   - [ ] API/Backend service
   - [ ] CLI tool
   - [ ] Other: ___________

2. What's the primary purpose? (e.g., e-commerce, social media, SaaS, internal tool)
   > Your answer: 

3. Who is your target audience?
   > Your answer:

4. Are you starting fresh or migrating existing code?
   > Your answer:

[... continue with all categories ...]
```

### Option 2: Interactive Mode
```markdown
## 🗨️ Interactive Requirements Discovery

Great! Let's go through this step by step.

### Category 1: Project Foundation

**What type of application are you building?**
- Web application
- Mobile application
- Desktop application  
- API/Backend service
- CLI tool
- Other

> Type your answer:
```

### Option 3: Quick Start
```markdown
## ⚡ Quick Start Mode

I'll ask just the essential questions to get started:

1. **Project type**: Web app, Mobile app, or API?
2. **Primary language**: JavaScript/TypeScript, Python, or other?
3. **User scale**: Hundreds, thousands, or millions?
4. **Timeline**: MVP in weeks or production in months?
5. **Special requirements**: Any compliance, real-time, or ML needs?

> Please provide brief answers:
```

### Step 5: Process Responses

**Agent analyzes responses and provides feedback**:
```markdown
✅ **Requirements Captured**

Based on your responses, I understand you're building:
- **Type**: [Identified type]
- **Scale**: [Identified scale]
- **Key Features**: [List of identified features]
- **Constraints**: [Identified constraints]

Let me research the best practices and design your workflow...

[Research phase - 15-30 seconds]
```

### Step 6: Generate Workflow

**Agent presents the workflow**:
```markdown
## 🎉 Custom Workflow Generated!

I've created a comprehensive development plan for your [project name].

### 📊 Workflow Summary
- **Total Agents**: [X] specialized agents
- **Estimated Timeline**: [Y] days
- **Phases**: [Z] development phases
- **Parallel Operations**: [N] optimization points

### 👀 Preview of Agent Orchestration:

**Phase 1: Foundation (Days 1-3)**
- feature-request-processor → Detailed requirements
- api-contract-designer → API architecture
- database-schema-architect → Data modeling

**Phase 2: Development (Days 4-10)**
[... preview continues ...]

**Would you like to:**
1. 📄 View the complete project_spec.md
2. 🚀 Start the workflow immediately
3. ✏️ Modify some requirements
4. 💬 Ask questions about the plan

> Type 1, 2, 3, or 4:
```

### Step 7: Workflow Execution Options

#### Option 1: View Complete Spec
```markdown
[Display full project_spec.md with all details]

**Ready to proceed?** Type 'start' to begin or 'modify' to make changes.
```

#### Option 2: Start Immediately
```markdown
🚀 **Workflow Initiated!**

Starting Phase 1 with the following agents:
- ✅ feature-request-processor (launching now...)
- ⏳ api-contract-designer (queued)
- ⏳ database-schema-architect (queued)

I'll provide updates as each agent completes their tasks.
```

#### Option 3: Modify Requirements
```markdown
✏️ **Requirement Modification**

What would you like to change?
1. Project type or technology stack
2. Timeline or team size
3. Features or integrations
4. Security or compliance needs
5. Other requirements

> Please specify:
```

## Error Handling

### Insufficient Information
```markdown
⚠️ **Need More Information**

To create an optimal workflow, I need a bit more detail about:
- [Missing requirement 1]
- [Missing requirement 2]

Would you like to:
1. Provide the missing information
2. Proceed with assumptions (I'll use industry best practices)
3. Start with a minimal setup and expand later

> Your choice:
```

### Conflicting Requirements
```markdown
🤔 **Requirement Clarification Needed**

I noticed some potential conflicts:
- [Conflict description]
- [Suggested resolution]

How would you like to proceed?
```

## Advanced Features

### Resume Previous Session
```markdown
🔄 **Welcome Back!**

I found an incomplete project specification from [date].
Project: [Project name]
Progress: [X]% complete

Would you like to:
1. Continue where you left off
2. Start fresh
3. View previous specifications

> Your choice:
```

### Template Selection
```markdown
📚 **Quick Start Templates**

Based on popular projects, would any of these templates work for you?

1. **E-commerce Platform** - React, Node.js, PostgreSQL
2. **SaaS Dashboard** - Next.js, GraphQL, MongoDB  
3. **Mobile Social App** - React Native, Firebase
4. **Enterprise API** - Python, FastAPI, microservices
5. **None** - Continue with custom questions

> Select template (1-5):
```

## Integration Points

### With Other Tools
- Connects to Context7 for framework documentation
- Uses web search for latest best practices
- Integrates with project management tools
- Exports to various formats (MD, JSON, YAML)

### Continuous Improvement
```markdown
📈 **Workflow Feedback**

After workflow completion, you'll be asked:
- What worked well?
- What could be improved?
- Any missing agents or steps?

This helps us improve future workflows!
```

## Command Reference

### Quick Commands During Setup
- `!skip` - Skip current question
- `!back` - Return to previous question
- `!summary` - Show current captured requirements
- `!templates` - Show available templates
- `!help` - Show available commands
- `!abort` - Cancel workflow creation

### Post-Generation Commands
- `!start` - Begin workflow execution
- `!modify [section]` - Modify specific section
- `!export [format]` - Export specification
- `!estimate` - Show time/cost estimates
- `!agents` - List all agents to be used

This trigger workflow ensures every project starts with comprehensive planning, leveraging the full power of the Spec Analyzer to create optimal agent orchestrations.