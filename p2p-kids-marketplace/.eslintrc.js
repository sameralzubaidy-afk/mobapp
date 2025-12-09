module.exports = {
  extends: [
    'expo',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    // Relax rules for initial scaffolding (placeholders will be converted to strict rules later)
    '@typescript-eslint/no-empty-object-type': 'off',
    '@typescript-eslint/no-wrapper-object-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'react/require-default-props': 'off',
    'react/function-component-definition': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'import/prefer-default-export': 'off',
    'react/jsx-props-no-spreading': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    // allow either function declarations or arrow functions for scaffolding
    'react/function-component-definition': 'off',
  },
};
