/**
 * Conventional Commits enforcement (commit-msg hook).
 *
 * Accepted types: build, chore, ci, docs, feat, fix, perf, refactor,
 * revert, style, test — matching the existing history
 * (e.g. `fix(security): bcrypt 6, nodemailer 10, rate-limit 8.7`).
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Line-length limits cause more friction than value (links, lists in
    // bodies get wrapped). Type/subject rules stay enforced.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
};
