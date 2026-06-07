```markdown
# cf-domain-finder Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill covers the core development patterns and conventions used in the `cf-domain-finder` TypeScript codebase. It documents file naming, import/export styles, commit patterns, and testing approaches. It also provides step-by-step workflows and suggested commands for common development tasks.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `domainFinder.ts`, `apiClient.ts`

### Import Style
- Use **relative imports** for internal modules.
  - Example:
    ```typescript
    import { getDomains } from './domainService';
    ```

### Export Style
- Use a **mixed export style** (both named and default exports may be present).
  - Example:
    ```typescript
    // Named export
    export function findAvailableDomains() { ... }

    // Default export
    export default DomainFinder;
    ```

### Commit Patterns
- Commits are **freeform** (no strict prefix required).
- Average commit message length: ~53 characters.
  - Example:
    ```
    Add support for filtering premium domains
    ```

## Workflows

### Running Tests
**Trigger:** When you want to verify code correctness.
**Command:** `/run-tests`

1. Locate test files matching the `*.test.*` pattern.
2. Use your preferred TypeScript test runner (e.g., Jest, Mocha) to execute tests.
   - Example:
     ```
     npx jest
     ```
3. Review test output for failures or errors.

### Adding a New Feature
**Trigger:** When implementing new functionality.
**Command:** `/add-feature`

1. Create a new file using camelCase naming (e.g., `newFeature.ts`).
2. Use relative imports to include dependencies.
3. Export your feature using named or default export as appropriate.
4. Write corresponding tests in a `*.test.ts` file.
5. Commit your changes with a clear, descriptive message.

### Refactoring Code
**Trigger:** When improving or restructuring existing code.
**Command:** `/refactor`

1. Identify the code to refactor.
2. Apply changes, maintaining camelCase file naming and relative imports.
3. Update exports if necessary.
4. Run tests to ensure nothing is broken.
5. Commit with a message describing the refactor.

## Testing Patterns

- Test files follow the `*.test.*` naming pattern (e.g., `domainFinder.test.ts`).
- The specific test framework is not detected; choose a compatible TypeScript test runner (such as Jest or Mocha).
- Example test file:
  ```typescript
  import { findAvailableDomains } from './domainFinder';

  test('returns available domains', () => {
    expect(findAvailableDomains(['example.com'])).toContain('example.com');
  });
  ```

## Commands

| Command       | Purpose                                      |
|---------------|----------------------------------------------|
| /run-tests    | Run all test files in the project            |
| /add-feature  | Steps to add a new feature                   |
| /refactor     | Steps to refactor existing code              |
```