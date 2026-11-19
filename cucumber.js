// A feature file, a scenario (file:line), a folder or a rerun file named on
// the command line of cucumber-js runs alone: `npx cucumber-js
// tests/features/session.feature`. cucumber-js 12 adds the paths of the
// command line to the `paths` of this file instead of using them alone, so
// `paths` is left empty when the command line names any, as in webship-js.
const OPTIONS_WITH_A_VALUE = new Set([
  '-c', '--config', '-f', '--format', '--format-options', '--i18n-keywords',
  '-i', '--import', '-l', '--loader', '--language', '--name', '--order',
  '-p', '--profile', '--parallel', '--plugin', '--plugin-options',
  '-r', '--require', '--require-module', '--retry', '--retry-tag-filter',
  '--shard', '-t', '--tags', '--world-parameters',
]);

function commandLinePaths() {
  // Only when cucumber-js itself runs, not when another script reads this file.
  if (!/cucumber(-js|\.js)?$/.test(String(process.argv[1] || ''))) return [];
  const args = process.argv.slice(2);
  const paths = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('-')) {
      if (OPTIONS_WITH_A_VALUE.has(args[i])) i += 1;
    } else {
      paths.push(args[i]);
    }
  }
  return paths;
}

// The default is the local DDEV site that .github/scripts/build-ddev-site.sh
// builds (project "djangosteps"), never a site of somebody else: the suite
// logs in with the accounts below and makes and deletes test objects.
// LAUNCH_URL points it at another site.
const launchUrl = process.env.LAUNCH_URL || 'https://djangosteps.ddev.site';

module.exports = {
  default: {
    // The step timeout is webship-js's (45 s, set when it loads): WEBSHIP_STEP_TIMEOUT=<milliseconds> changes it; a `timeout` key here is ignored.
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',          // Webship-js core step definitions (auto HTML report on exit; disable: WEBSHIP_REPORT_DISABLE=1).
      'tests/step-definitions/**/*.js',                                  // The step definitions of this pack.
    ],
    // FEATURES=tests/features/a.feature,tests/features/b.feature runs a subset too.
    paths: process.env.FEATURES ? process.env.FEATURES.split(',') : (commandLinePaths().length ? [] : ['tests/features/**/*.feature']),
    // CUCUMBER_TAGS=@change-list runs a lane. The default leaves out work in progress and the assertions that
    // must fail (tests/check-must-fail.js runs them).
    tags: process.env.CUCUMBER_TAGS || 'not @wip and not @must-fail',
    format: [
      '@cucumber/pretty-formatter',
      // REPORT_NAME=must-fail keeps the report of another run (tests/check-must-fail.js) apart.
      `json:tests/reports/${process.env.REPORT_NAME || 'cucumber_report'}.json`,
    ],
    formatOptions: {
      // Colours follow the terminal (GitHub Actions counts as one); FORCE_COLOR=1
      // or FORCE_COLOR=0 sets them. cucumber-js 12 deprecated `colorsEnabled`.
      theme: {
        'feature keyword': ['bold', 'blue'],
        'feature name': ['blue', 'underline'],
        'feature description': ['blueBright'],
        'scenario keyword': ['bold', 'magenta'],
        'scenario name': ['magenta', 'underline'],
        'step keyword': ['bold', 'green'],
        'step text': ['greenBright', 'italic'],
      },
    },
    worldParameters: {
      launchUrl,
      // The path of the admin on the site ('/admin/' as startproject sets it).
      adminPath: process.env.ADMIN_PATH || '/admin/',
      // The account the test-data steps work as: it makes and deletes the test objects through the admin's own
      // forms, in a session of its own, and sets a changed password back. A handle of `users`, a superuser.
      dataAdmin: process.env.DATA_ADMIN || 'administrator',
      // The steps delete after each scenario what it made: the objects of the test-data steps, the ones added
      // through the forms on screen, and a changed password set back. false keeps them.
      adminCleanUp: process.env.ADMIN_CLEAN_UP !== 'false',
      // An account that logged in once keeps its session for the rest of the run: later scenarios take it
      // over instead of filling in the login form again.
      reuseSessions: process.env.REUSE_SESSIONS !== 'false',
      // Video of the browser: 'off', 'on', 'on-failure' or 'tag' (scenarios tagged @video; @no-video opts out).
      video: { mode: process.env.WEBSHIP_VIDEO || 'off', dir: './videos', size: { width: 1280, height: 720 }, filenamePattern: '{datetime}.{feature_file}.{scenario}.{status}.{ext}' },
      // JavaScript errors the page raises: 'warn' reports them, 'fail' fails the scenario, 'off' ignores them;
      // @js-fail, @js-warn and @js-off per scenario. Ignored, as no error of the site:
      //   - "Permissions policy violation: unload is not allowed in this document": current browsers log it on
      //     the admin's pages of the 5.2 line (its RelatedObjectLookups.js listens to the page's unload; 6.0
      //     and later do not);
      //   - "Failed to load resource: net::ERR_NETWORK_CHANGED": the browser lost a request when the network
      //     of the machine changed (another container starting); a step that needed it says so.
      // The refused pages carry @js-off: the browser logs "Failed to load resource: the server responded
      // with a status of 403" for each of them.
      javascript: { mode: process.env.WEBSHIP_JS_ERROR_MODE || 'warn', levels: ['error'], ignore: 'Permissions policy violation: unload is not allowed|net::ERR_NETWORK_CHANGED', beforeScenario: false, afterScenario: true },
      // The accounts that "I am a logged in user with the ... user" uses, by handle. They are configuration,
      // not test data: the build of the site creates them once (.github/scripts/build-ddev-site.sh, or the
      // Webship Workspace's builder) and a feature never creates or deletes an account. Point the suite at
      // another site with the *_USERNAME and *_PASSWORD variables.
      users: {
        // a superuser: every permission; the test-data steps work as this account.
        administrator: {
          username: process.env.ADMINISTRATOR_USERNAME || 'administrator',
          password: process.env.ADMINISTRATOR_PASSWORD || 'dD.123123ddd',
          email: process.env.ADMINISTRATOR_EMAIL || 'administrator@example.com',
        },
        // staff, in the group Editors: adds, changes, deletes and views the objects of the site's own apps.
        editor: {
          username: process.env.EDITOR_USERNAME || 'editor',
          password: process.env.EDITOR_PASSWORD || 'dD.123123ddd',
          email: process.env.EDITOR_EMAIL || 'editor@example.com',
        },
        // staff, in the group Viewers: views the objects of the site's own apps, nothing else.
        viewer: {
          username: process.env.VIEWER_USERNAME || 'viewer',
          password: process.env.VIEWER_PASSWORD || 'dD.123123ddd',
          email: process.env.VIEWER_EMAIL || 'viewer@example.com',
        },
      },
      minWaitTime: {
        page: 3000,
        before_scenario: 0,
        after_scenario: 0,
        before_step: 0,
        after_step: 0,
      },
      selectors: {
        css: {},
        xpath: {},
        filesPath: './tests/selectors/',
        files: [],
        offset: 60,
        breakpoints: {
          xs:   { width: 375,  height: 667  },
          sm:   { width: 576,  height: 800  },
          md:   { width: 768,  height: 1024 },
          lg:   { width: 992,  height: 768  },
          xl:   { width: 1200, height: 900, default: true },
          xxl:  { width: 1400, height: 900  },
          xxxl: { width: 1920, height: 1080 },
        },
      },
      screenshot: {
        dir: './screenshots',
        purge: false,
        onFailed: true,
        onEveryStep: false,
        alwaysFullscreen: false,
        failedPrefix: 'failed_',
        filenamePattern: '{datetime}.{feature_file}.feature_{step_line}.{ext}',
        filenamePatternFailed: '{failed_prefix}{datetime}.{feature_file}.feature_{step_line}.{ext}',
        infoTypes: '',
      },
    },
  },
};
