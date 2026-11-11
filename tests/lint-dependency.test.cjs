const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { ESLint } = require('eslint');
const parser = require('@typescript-eslint/parser');
const plugin = require('@typescript-eslint/eslint-plugin');

// Exercises projectService's allowDefaultProject glob matching with the scoped
// minimatch override, rather than only checking the dependency version string.
test('patched glob matching preserves type-aware ESLint parser diagnostics', async () => {
  const root = path.resolve(__dirname, '..');
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [{
      files: ['**/*.ts'],
      languageOptions: {
        parser,
        parserOptions: {
          tsconfigRootDir: root,
          projectService: { allowDefaultProject: ['eslint-compat-fixture.ts'] },
        },
      },
      plugins: { '@typescript-eslint': plugin },
      rules: { '@typescript-eslint/no-floating-promises': 'error' },
    }],
  });
  const [result] = await eslint.lintText('async function example(): Promise<void> {}\nexample();\n', {
    filePath: path.join(root, 'eslint-compat-fixture.ts'),
  });
  assert.equal(result.fatalErrorCount, 0);
  assert.equal(result.messages.length, 1);
  assert.equal(result.messages[0].ruleId, '@typescript-eslint/no-floating-promises');
});
