const {
    defineConfig,
    globalIgnores,
} = require("eslint/config");

const globals = require("globals");
const tsParser = require("@typescript-eslint/parser");
const typescriptEslintEslintPlugin = require("@typescript-eslint/eslint-plugin");

const {
    fixupConfigRules,
} = require("@eslint/compat");

const n8nNodesBase = require("eslint-plugin-n8n-nodes-base");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([{
    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.node,
        },

        parser: tsParser,
    },

    plugins: {
        "@typescript-eslint": typescriptEslintEslintPlugin,
    },

    extends: fixupConfigRules(compat.extends(
        "plugin:@typescript-eslint/recommended",
        "prettier",
        "plugin:prettier/recommended",
        "plugin:import/errors",
        "plugin:import/warnings",
        "plugin:import/typescript",
    )),

    rules: {
        "prettier/prettier": ["error", {
            singleQuote: false,
        }],

        "@typescript-eslint/no-explicit-any": "off",

        "@typescript-eslint/no-unused-vars": ["error", {
            ignoreRestSiblings: true,
        }],

        semi: ["error", "always"],
        quotes: [2, "double", "avoid-escape"],
        "eol-last": ["error", "always"],

        "import/order": ["error", {
            "newlines-between": "always",

            alphabetize: {
                order: "asc",
            },
        }],
    },

    settings: {
        "import/resolver": {
            typescript: {},
        },
    },
}, globalIgnores(["**/node_modules/", "**/dist/"]), {
    files: ["**/package.json"],

    plugins: {
        "n8n-nodes-base": n8nNodesBase,
    },

    extends: compat.extends("plugin:n8n-nodes-base/community"),

    rules: {
        "n8n-nodes-base/community-package-json-name-still-default": "off",
    },
}, {
    files: ["./src/**/*.ts"],

    plugins: {
        "n8n-nodes-base": n8nNodesBase,
    },

    extends: compat.extends("plugin:n8n-nodes-base/nodes"),

    rules: {
        "n8n-nodes-base/node-execute-block-missing-continue-on-fail": "off",
        "n8n-nodes-base/node-resource-description-filename-against-convention": "off",
        "n8n-nodes-base/node-param-fixed-collection-type-unsorted-items": "off",
    },
}]);
