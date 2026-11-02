import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [{
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@typescript-eslint': typescriptEslint },
    languageOptions: {
        parser: tsParser,
        parserOptions: { project: ['tsconfig.json'] },
    },
    rules: {
        '@typescript-eslint/naming-convention': ['error', { selector: ['class', 'interface'], format: ['PascalCase'] }],
        // a typed rule, so typed linting does real work
        '@typescript-eslint/no-floating-promises': 'error',
    },
}];
