# Mobile App Development Workflow

## Overview
This workflow orchestrates agents to develop a mobile application from scratch or convert an existing web application, ensuring optimal performance, native features, and cross-platform compatibility.

## Workflow Prompt

"Develop mobile application for [PROJECT_NAME] with:
- iOS and Android native apps
- React Native implementation
- Progressive Web App (PWA)
- Native feature integration
- Offline capabilities
- App store deployment
- Performance optimization
- Cross-platform consistency

## Agent Execution Sequence

### Phase 1: Planning & Architecture (Day 1-2)

1. **feature-request-processor**
   - Input: Mobile app requirements
   - Output: Mobile-specific PRD
   - Focus: Platform features, offline needs
   - Time: 3 hours

2. **prd-task-generator**
   - Input: Mobile PRD
   - Output: Platform-specific task lists
   - Separate: iOS, Android, shared code
   - Time: 2 hours

3. **react-native-converter**
   - Input: Existing web app (if any)
   - Output: Conversion feasibility report
   - Analysis: Reusable components
   - Time: 4 hours

4. **design-pattern-advisor**
   - Input: Mobile architecture needs
   - Output: Mobile pattern recommendations
   - Focus: Navigation, state, offline
   - Time: 2 hours

### Phase 2: API & Backend Adaptation (Day 3)

5. **api-contract-designer**
   - Input: Mobile API requirements
   - Output: Mobile-optimized APIs
   - Focus: Pagination, compression, sync
   - Time: 3 hours

6. **backend-security-auditor**
   - Input: Mobile API security
   - Output: Mobile security strategy
   - Focus: Token management, SSL pinning
   - Time: 3 hours

7. **database-schema-architect**
   - Input: Offline data needs
   - Output: Local database schema
   - Design: SQLite, Realm strategies
   - Time: 2 hours

### Phase 3: Core Development (Days 4-8)

8. **react-native-converter**
   - Input: Web components
   - Output: React Native components
   - Convert: Navigation, UI, state
   - Time: 16 hours

9. **mobile-performance-optimizer**
   - Input: Initial implementation
   - Output: Performance improvements
   - Focus: Memory, battery, startup
   - Time: 8 hours

10. **pragmatic-code-wizard**
    - Input: Complex mobile features
    - Output: Native module solutions
    - Implement: Camera, GPS, sensors
    - Time: 8 hours

### Phase 4: Native Features (Days 9-10)

11. **ml-integration-specialist** (if ML features)
    - Input: ML requirements
    - Output: On-device ML implementation
    - Focus: Core ML, TensorFlow Lite
    - Time: 6 hours

12. **analytics-event-architect**
    - Input: Mobile analytics needs
    - Output: Mobile tracking setup
    - Implement: Firebase, Amplitude
    - Time: 3 hours

13. **pwa-specialist**
    - Input: Web application
    - Output: PWA implementation
    - Features: Install, offline, push
    - Time: 6 hours

### Phase 5: Testing & Quality (Days 11-12)

14. **e2e-test-architect**
    - Input: Mobile user flows
    - Output: Detox/Appium tests
    - Coverage: iOS, Android, PWA
    - Time: 8 hours

15. **performance-test-engineer**
    - Input: Mobile app builds
    - Output: Performance benchmarks
    - Test: Various devices, networks
    - Time: 4 hours

16. **accessibility-tester**
    - Input: Mobile interfaces
    - Output: Mobile a11y audit
    - Check: VoiceOver, TalkBack
    - Time: 4 hours

### Phase 6: Platform Optimization (Days 13-14)

17. **mobile-performance-optimizer**
    - Input: Test results
    - Output: Platform-specific optimizations
    - Optimize: Animations, lists, images
    - Time: 8 hours

18. **dependency-analyzer**
    - Input: Mobile dependencies
    - Output: Bundle size optimization
    - Reduce: Native modules, JS bundle
    - Time: 3 hours

19. **design-pattern-advisor**
    - Input: Performance bottlenecks
    - Output: Mobile-specific patterns
    - Apply: Virtualization, lazy loading
    - Time: 3 hours

### Phase 7: Security & Privacy (Day 15)

20. **backend-security-auditor**
    - Input: Mobile app security
    - Output: Security hardening
    - Implement: Keychain, encryption
    - Time: 4 hours

21. **data-pipeline-designer**
    - Input: Sync requirements
    - Output: Offline sync pipeline
    - Design: Conflict resolution
    - Time: 4 hours

### Phase 8: Deployment Preparation (Days 16-17)

22. **ci-cd-pipeline-builder**
    - Input: Mobile build needs
    - Output: Mobile CI/CD pipelines
    - Setup: Fastlane, code signing
    - Time: 6 hours

23. **docker-compose-architect**
    - Input: Build environment
    - Output: Mobile build containers
    - Include: Android SDK, Xcode
    - Time: 3 hours

24. **infrastructure-cost-optimizer**
    - Input: Mobile backend needs
    - Output: Cost-efficient mobile infra
    - Optimize: CDN, API Gateway
    - Time: 3 hours

### Phase 9: Store Deployment (Days 18-19)

25. **api-doc-generator**
    - Input: Mobile APIs
    - Output: Mobile API docs
    - Format: SDK documentation
    - Time: 3 hours

26. **user-guide-writer**
    - Input: Mobile features
    - Output: In-app help, onboarding
    - Create: Tutorials, tooltips
    - Time: 4 hours

27. **changelog-curator**
    - Input: Mobile features
    - Output: App store changelog
    - Format: User-friendly updates
    - Time: 2 hours

### Phase 10: Post-Launch (Day 20)

28. **analytics-event-architect**
    - Input: Launch metrics
    - Output: Mobile analytics dashboard
    - Track: Crashes, usage, retention
    - Time: 3 hours

29. **comedy-code-roaster** (team morale)
    - Input: Mobile dev challenges
    - Output: Humorous retrospective
    - Boost: Team learning, morale
    - Time: 1 hour

30. **emoji-translator-pro**
    - Input: App launch announcement
    - Output: Social media content
    - Create: Engaging announcements
    - Time: 30 minutes

## Platform-Specific Considerations

### iOS Development
- Swift UI components
- Core Data integration
- HealthKit/HomeKit APIs
- App Store guidelines
- TestFlight deployment
- iOS-specific gestures
- Face ID/Touch ID

### Android Development
- Material Design compliance
- Room database
- Google Play services
- Multiple screen sizes
- API level targeting
- ProGuard configuration
- Play Store requirements

### React Native Specifics
- Native module bridging
- Platform-specific code
- Navigation patterns
- Performance optimization
- Hot reload setup
- Hermes engine
- Flipper debugging

### PWA Requirements
- Service worker setup
- Web app manifest
- Offline functionality
- Push notifications
- App shell architecture
- Cache strategies
- Install prompts

## Testing Strategy

### Device Testing Matrix
- **iOS**: iPhone 12-15, iPad Pro/Air
- **Android**: Pixel 6-8, Samsung Galaxy S21-23
- **OS Versions**: iOS 15+, Android 10+
- **Network**: 3G, 4G, 5G, WiFi, Offline
- **Screen Sizes**: Phone, Tablet, Foldable

### Automated Testing
- Unit tests: Jest, React Native Testing Library
- Integration tests: Detox (iOS/Android)
- E2E tests: Appium (cross-platform)
- Performance: Firebase Test Lab
- Crash testing: Crashlytics

## Performance Targets

### App Performance
- Cold start: < 2 seconds
- Warm start: < 1 second
- Memory usage: < 150MB
- Battery drain: < 3% per hour
- 60 FPS scrolling
- Network efficiency

### PWA Performance
- Lighthouse score: > 95
- First paint: < 1.5s
- Time to interactive: < 3s
- Offline functionality: 100%
- Install success rate: > 80%

## App Store Optimization

### Metadata
- App title and subtitle
- Keywords optimization
- Description with features
- Screenshots (all sizes)
- App preview videos
- Localization (10+ languages)

### Technical Requirements
- App size < 150MB
- IPv6 compatibility
- 64-bit support
- Privacy policy
- Age rating
- Export compliance

## Success Metrics

- ✅ App Store approval (first attempt)
- ✅ Play Store approval (first attempt)
- ✅ 4.5+ star rating target
- ✅ < 1% crash rate
- ✅ 60% day-1 retention
- ✅ 30% day-7 retention
- ✅ PWA install rate > 20%
- ✅ Performance scores > 90
- ✅ Accessibility compliant
- ✅ Security audit passed

## Post-Launch Monitoring

1. **Crash Reporting**
   - Crashlytics/Sentry setup
   - Crash-free rate > 99%
   - Quick fix turnaround

2. **Performance Monitoring**
   - Firebase Performance
   - Custom metrics tracking
   - Degradation alerts

3. **User Analytics**
   - User flows tracking
   - Feature adoption
   - Retention analysis

4. **Store Reviews**
   - Review monitoring
   - Response automation
   - Rating improvement

## Continuous Improvement

- Weekly performance reviews
- Bi-weekly feature updates
- Monthly security scans
- Quarterly UX improvements
- User feedback integration
- A/B testing new features"