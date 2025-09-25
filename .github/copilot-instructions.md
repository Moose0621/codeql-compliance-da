# GitHub Copilot Instructions

## Project Overview

This is the **Enterprise CodeQL Security Dashboard**, a React 19 application built with TypeScript that provides comprehensive security compliance management for GitHub organizations. The application enables real-time monitoring and on-demand dispatch of CodeQL workflows across repositories to meet FedRAMP audit requirements.

### Key Technologies
- **Frontend**: React 19, TypeScript, Vite 6.x
- **UI Framework**: Tailwind CSS 4.x + Radix UI components
- **State Management**: React hooks + GitHub Spark persistence
- **GitHub Integration**: Octokit REST API client
- **Testing**: Vitest + Playwright for E2E
- **Deployment**: Azure Static Web Apps + Functions
- **Infrastructure**: Bicep templates for Azure resources

## Code Patterns & Standards

### TypeScript Guidelines
- Use strict TypeScript configuration with `strictNullChecks: true`
- Define types in `/src/types/` directory
- Use path aliases (`@/*` maps to `src/*`)
- Prefer interface over type for object definitions
- Use proper error handling with Result patterns where applicable

### React Patterns
- Use functional components with hooks
- Prefer composition over inheritance
- Use React 19 features (concurrent features, automatic batching)
- Implement proper error boundaries for robustness
- Use Radix UI components from `/src/components/ui/` for consistency

### GitHub API Integration
- All GitHub API calls go through `/src/lib/github-service.ts`
- Implement proper rate limiting and retry logic
- Cache responses appropriately with TTL
- Use installation tokens for GitHub App authentication
- Handle pagination for large datasets

### State Management
- Use React hooks for local state
- Persist configuration and audit data with GitHub Spark
- Implement optimistic updates where appropriate
- Use React Query for server state management

### Styling
- Use Tailwind CSS 4.x utility classes
- Follow the existing component structure in `/src/components/`
- Use CSS variables for theming (supports dark/light modes)
- Maintain responsive design patterns

## Architecture Principles

### Security First
- Never commit secrets or tokens to code
- Use environment variables for configuration
- Implement proper CORS and CSP headers
- Follow GitHub App security best practices
- Validate all inputs and sanitize outputs

### Performance
- Implement virtualization for large lists (1000+ repositories)
- Use React.lazy for code splitting
- Optimize bundle size with tree shaking
- Cache API responses appropriately
- Use loading states and skeleton UIs

### Scalability
- Design for 1000+ repositories
- Implement proper pagination
- Use concurrent API requests where safe
- Handle rate limiting gracefully
- Support incremental data loading

## Development Workflow

### Commands
```bash
npm run dev          # Development server
npm run build        # Production build  
npm run lint         # ESLint checking
npm run typecheck    # TypeScript validation
npm run test         # Run unit tests with coverage
npm run test:e2e     # Playwright E2E tests
```

### Code Quality
- All code must pass ESLint and TypeScript checks
- Maintain test coverage above 80%
- Use Prettier formatting (configured in package.json)
- Write meaningful commit messages
- Follow conventional commit format

### Testing Strategy
- Unit tests for utility functions and hooks
- Integration tests for GitHub API services
- E2E tests for critical user flows
- Mock external APIs in tests
- Test error scenarios and edge cases

## File Structure Guidelines

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Radix UI component library
│   ├── GitHubConnection.tsx
│   ├── RepositoryCard.tsx
│   └── SecurityChart.tsx
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries
│   ├── github-service.ts
│   ├── export-utils.ts
│   └── utils.ts
├── types/              # TypeScript definitions
├── __tests__/          # Test files
└── styles/             # CSS and theme files
```

## Specific Guidance

### When Adding New Features
1. Start with TypeScript types in `/src/types/`
2. Create reusable components in appropriate directories
3. Update GitHub service if API integration needed
4. Add comprehensive tests
5. Update documentation as needed

### GitHub API Usage
- Always use the GitHubService class
- Implement proper error handling for rate limits
- Use pagination for list endpoints
- Cache results when appropriate
- Handle authentication errors gracefully

### UI Components  
- Use existing Radix UI components from `/src/components/ui/`
- Follow the established design system
- Implement loading and error states
- Ensure accessibility compliance
- Support both light and dark themes

### Azure Integration
- Infrastructure changes go in `/infra/` directory
- Use Bicep for all Azure resources
- Follow the modular template structure
- Update parameter files for environments
- Document deployment requirements

### Error Handling
- Use React Error Boundaries for UI errors  
- Implement proper API error handling
- Provide meaningful error messages to users
- Log errors appropriately for debugging
- Implement retry logic where applicable

## Common Tasks

### Adding a New Repository Card Feature
1. Update `Repository` type in `/src/types/dashboard.ts`
2. Add GitHub API method to `/src/lib/github-service.ts` 
3. Create/update component in `/src/components/RepositoryCard.tsx`
4. Add tests for new functionality
5. Update documentation if needed

### Adding New GitHub API Integration
1. Add method to GitHubService class
2. Include proper TypeScript types
3. Implement error handling and retries
4. Add unit tests with mocked responses
5. Update rate limiting considerations

### Creating New UI Components
1. Place in appropriate `/src/components/` subdirectory
2. Use Radix UI primitives where possible
3. Follow existing styling patterns
4. Include TypeScript props interface
5. Add Storybook story if complex component

## Documentation
- Architecture details in `/docs/architecture.md`
- Deployment guide in `/docs/azure-deployment.md`
- Agent execution patterns in `/docs/copilot-agent-plan.md`
- API documentation inline with code
- Update README.md for major changes

Remember to follow the existing patterns and maintain consistency with the codebase. When in doubt, refer to existing implementations for guidance.