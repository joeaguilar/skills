# Command Conventions for Agent Workflows

## Overview
To avoid conflicts with Claude's built-in slash commands, our agent workflows use alternative command prefixes.

## Command Prefix Guidelines

### 1. **Agent Workflow Commands: `@` prefix**
Used for initiating agent workflows:
- `@init` - Initialize new project
- `@scaffold` - Scaffold application
- `@new` - Create new project
- `@workflow` - Start specific workflow
- `@agent [name]` - Invoke specific agent

### 2. **In-Workflow Navigation: `!` prefix**
Used for navigation and control within active workflows:
- `!skip` - Skip current step
- `!back` - Go to previous step
- `!summary` - Show current state
- `!help` - Show available commands
- `!abort` - Cancel current workflow
- `!pause` - Pause workflow
- `!resume` - Resume workflow

### 3. **Query Commands: `?` prefix**
Used for information queries:
- `?status` - Check workflow status
- `?agents` - List available agents
- `?workflows` - List available workflows
- `?history` - Show command history
- `?docs` - Access documentation

### 4. **Configuration Commands: `#` prefix**
Used for settings and configuration:
- `#config` - View configuration
- `#set [key] [value]` - Set configuration value
- `#theme` - Change interface theme
- `#verbose` - Toggle verbose mode
- `#debug` - Enable debug output

## Natural Language Alternatives

Users can always use natural language instead of commands:
- "Initialize a new project" → `@init`
- "Skip this question" → `!skip`
- "Show me available agents" → `?agents`
- "Change settings" → `#config`

## Command Conflicts Resolution

### Reserved for Claude:
- `/` prefix - Claude's built-in commands
- Standard slash commands remain unchanged

### Our Workflow System:
- `@` - Action/start commands
- `!` - Control/navigation commands
- `?` - Query/info commands
- `#` - Configuration commands

## Examples in Context

### Starting a Project
```
User: @init e-commerce platform
// OR
User: I want to build an e-commerce platform
```

### During Workflow
```
Spec Analyzer: What type of database do you prefer?
User: !skip
// OR
User: Skip this question
```

### Getting Information
```
User: ?agents
// OR
User: Show me all available agents
```

### Configuration
```
User: #set timeline aggressive
// OR
User: Set timeline to aggressive mode
```

## Implementation Notes

1. **Command Parser Priority**:
   - Check for Claude slash commands first
   - Then check for our prefix commands
   - Finally, parse natural language

2. **Command Validation**:
   - Validate command syntax
   - Provide helpful error messages
   - Suggest corrections for typos

3. **Command History**:
   - Track command usage
   - Provide command suggestions
   - Enable command shortcuts

## Quick Reference Card

```
🚀 Starting Workflows
@init, @scaffold, @new, @workflow

🎮 Workflow Control  
!skip, !back, !summary, !help, !abort

❓ Information
?status, ?agents, ?workflows, ?docs

⚙️ Configuration
#config, #set, #theme, #debug
```

This convention ensures smooth interaction without interfering with Claude's native functionality.