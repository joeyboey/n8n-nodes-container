import { config } from '@n8n/node-cli/eslint';

// This is a SELF-HOSTED node package that requires external dependencies.
// It is NOT compatible with n8n Cloud and is intended for self-hosted installations only.
// We need to disable the restrictive rules meant for cloud-compatible community nodes.

export default [
	...config,
	{
		// Global overrides for self-hosted node package
		rules: {
			// CRITICAL: This node uses external dependencies (dockerode, @kubernetes/client-node)
			// Disable all n8n Cloud compatibility checks
			'n8n-nodes-base/community-package-json-name-still-default': 'off',
			'n8n-nodes-base/node-class-description-credentials-name-unsuffixed': 'off',
			'n8n-nodes-base/node-execute-block-wrong-error-thrown': 'off',
			'n8n-nodes-base/cred-class-field-authenticate-type-assertion': 'off',
			'n8n-nodes-base/cred-class-name-unsuffixed': 'off',
			'n8n-nodes-base/cred-class-name-missing-oauth2-suffix': 'off',
			'@n8n/community-nodes/no-restricted-imports': 'off',
			'@n8n/community-nodes/no-credential-reuse': 'off',

			// Allow async promise executors (used in Kubernetes watch API)
			'no-async-promise-executor': 'warn',

			// Allow node:stream and other Node.js built-ins
			'import/no-unresolved': 'off',
		},
	},
	{
		// Source files: Allow external dependencies
		files: ['src/**/*.ts'],
		rules: {
			// This is a self-hosted node - external dependencies are required
			'import/no-extraneous-dependencies': 'off',

			// Credentials are properly defined in package.json n8n.credentials
			'n8n-nodes-base/node-class-description-credentials-name-unsuffixed': 'off',
		},
	},
	{
		// Scripts and test files: Maximum flexibility
		files: ['scripts/**/*.ts', 'test-*.js', 'test-*.ts', '*.config.js', '*.config.mjs'],
		rules: {
			'import/no-extraneous-dependencies': 'off',
			'@typescript-eslint/no-var-requires': 'off',
			'@typescript-eslint/no-require-imports': 'off',
			'n8n-nodes-base/node-class-description-credentials-name-unsuffixed': 'off',
		},
	},
	{
		// Ignore generated and cache directories
		ignores: ['dist/**', 'lib/**', 'node_modules/**', '.rudi/**', '.husky/**'],
	},
];
