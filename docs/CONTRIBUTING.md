# Contributing Guide

How to contribute, future enhancements, support resources, and license information.

[← Back to Main Documentation](../PROJECT.md)

---

## Future Enhancements

### Planned Features
- [ ] **Achievements System**: Unlock badges for milestones
- [ ] **Leaderboards**: Compare stats with friends
- [ ] **Study Groups**: Collaborative pomodoro sessions
- [ ] **Custom Themes**: User-selectable color schemes
- [ ] **Charts & Analytics**: Visualize study patterns
- [ ] **Break Timer**: Enforce breaks between pomodoros
- [ ] **Task Management**: Built-in todo list
- [ ] **Notifications**: Discord notifications for session completion
- [ ] **Mobile App**: Native iOS/Android apps
- [ ] **Widget**: Discord server widget showing online users

### Technical Improvements
- [ ] **Testing**: Add Jest + React Testing Library
- [ ] **E2E Tests**: Playwright for critical flows
- [ ] **Error Tracking**: Sentry integration
- [ ] **Analytics**: PostHog or similar
- [ ] **Performance Monitoring**: Vercel Analytics
- [ ] **Database Backups**: Automated backup strategy
- [ ] **Rate Limiting**: Protect edge functions
- [ ] **Webhook Events**: Discord webhooks for notifications

---

## Contributing

When contributing to this project:

1. **Read this document**: Understand architecture and security measures
2. **Follow conventions**: TypeScript, ESLint, Prettier
3. **Test thoroughly**: Especially auth and data flows
4. **Security first**: Never bypass RLS, always verify ownership
5. **Document changes**: Update this file for major changes
6. **Commit messages**: Use conventional commits (feat:, fix:, docs:, etc.)

### Security Checklist for Contributors

Before submitting changes:
- [ ] No direct database updates that bypass RLS
- [ ] All SECURITY DEFINER functions have authorization checks
- [ ] No sensitive data logged to console
- [ ] No API keys/secrets in code
- [ ] Input validation on all user inputs
- [ ] SQL injection prevention via parameterized queries
- [ ] XSS prevention (React handles automatically, but verify)
- [ ] CSRF prevention (JWT in headers, not cookies)

---

## Support & Resources

### Documentation
- [Discord Activities Guide](https://discord.com/developers/docs/activities/overview)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

### Community
- Discord Activities Developer Server
- Supabase Discord Community
- GitHub Issues for this repository

### Contact
For questions or issues, create a GitHub issue or reach out via Discord.

---

## License

[Your License Here]
