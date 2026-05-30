# Sub Agent Feature

> A workflow to have sub agent build, test, verify, and fix features as requested.

Given the context of the project, summarize this user request as a feature request:

	<user_request>
	$ARGUMENTS
	</user_request>

The project should be in TDD style, so test must be written first then validated against. Use a sub agent for this.

Make a plan to implement the feature, considering hitting all the tenets of great design: clean code, locality of behaviour, less than 300 lines if possible, encapsulate, React container-wrapper pattern, React Server Components, KISS, WET (Write Everything Twice, and on a third, refactor into a utility).

As you draft the plan consider the work needed to be done, if it needs to be done by a team or by one subagent, use this prompt along your description of the work to be done, this will ensure a clean TDD style.

<Subagent prompt>
# 5-Step TDD Process Guide for TypeScript/Vite/React Development

This is your workflow for building features using Test-Driven Development. Follow these 5 steps for every new component, hook, or feature you build.

---

## Step 1: 📝 Plan & Write Failing Test (Red)

**What to do:**
- Write a test that describes the desired behavior
- Run the test to confirm it fails
- Keep the test focused on one specific behavior

**Example:**
```typescript
// Button.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('should display the provided text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

**Commands:**
```bash
npm run test -- --watch  # Run tests in watch mode
```

---

## Step 2: ✅ Write Minimal Code (Green)

**What to do:**
- Write the simplest code that makes the test pass
- Don't overthink or over-engineer
- Hardcode values if needed to get to green quickly

**Example:**
```typescript
// Button.tsx
interface ButtonProps {
  children: string;
}

export const Button: React.FC<ButtonProps> = ({ children }) => {
  return <button>{children}</button>;
};
```

**Commands:**
```bash
npm run test  # Verify test passes
```

---

## Step 3: 🔄 Refactor & Improve

**What to do:**
- Improve the implementation without changing behavior
- Add proper types and error handling
- Ensure all tests still pass

**Example:**
```typescript
// Button.tsx - Refactored
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary',
  disabled = false 
}) => {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant}`}
    >
      {children}
    </button>
  );
};
```

**Commands:**
```bash
npm run test       # Ensure tests pass
npm run lint       # Check code quality
npm run typecheck  # Verify TypeScript
```

---

## Step 4: 📦 Add More Tests

**What to do:**
- Add tests for additional behaviors or edge cases
- Test user interactions with `userEvent`
- Mock external dependencies with MSW

**Example:**
```typescript
// Button.test.tsx - Additional tests
describe('Button', () => {
  it('should call onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={onClick}>Click me</Button>);
    await user.click(screen.getByText('Click me'));
    
    expect(onClick).toHaveBeenCalled();
  });
  
  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDisabled();
  });
});
```

**Commands:**
```bash
npm run test -- --coverage  # Check test coverage
```

---

## Step 5: 🚀 Integrate & Validate

**What to do:**
- Run all tests to ensure nothing breaks
- Test the component in your actual application
- Update any integration or E2E tests if needed

**Example E2E Test:**
```typescript
// login.spec.ts (Playwright)
import { test, expect } from '@playwright/test';

test('user can log in successfully', async ({ page }) => {
  await page.goto('/login');
  
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL('/dashboard');
});
```

**Commands:**
```bash
npm run test            # Run all unit/integration tests
npm run test:e2e        # Run E2E tests
npm run build           # Ensure app builds correctly
```

---

## Workflow Commands

```bash
# Start development with tests
npm run dev & npm run test -- --watch

# Before committing changes
npm run test && npm run lint && npm run typecheck

# Pre-push validation
npm run test:ci && npm run build
```

## Quick Troubleshooting

### Test Won't Pass? Check:
1. Is the test syntax correct?
2. Are you importing the component properly?
3. Is TypeScript configured correctly?

### Build Fails? Check:
1. Run `npm run typecheck` for TypeScript errors
2. Run `npm run lint` for code style issues
3. Check import paths and exports

### E2E Tests Flaky? Try:
1. Add `await page.waitFor()` for dynamic content
2. Use `data-testid` attributes for stable selectors
3. Increase timeout values if needed

## Remember

- **One test at a time** - Don't write multiple tests before implementation
- **Green first** - Always get to passing before refactoring
- **Small steps** - Each cycle should be 5-15 minutes
- **Commit often** - After each successful cycle
- **Feedback loop** - Keep tests running and watch for immediate feedback

---

### Need help?
- Review existing patterns in the codebase
- Ask for code review early and often
</Subagent prompt>