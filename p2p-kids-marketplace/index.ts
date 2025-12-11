import { registerRootComponent } from 'expo';

// Prefer a lightweight dev entrypoint when running in development with Expo Go.
// This lets us avoid native/production screens that may throw runtime errors
// (e.g., due to native module incompatibilities) while preserving the
// default `App` behavior for all other environments.
let AppToRegister: any;

if (typeof __DEV__ !== 'undefined' && __DEV__) {
	try {
		// Attempt to load the optional development entry created for Expo Go.
		// If the file doesn't exist, fall back to the main App.
		// eslint-disable-next-line global-require, import/no-dynamic-require
		AppToRegister = require('./App.dev').default;
	} catch (e) {
		// eslint-disable-next-line global-require
		AppToRegister = require('./App').default;
	}
} else {
	// Production / non-dev: use the normal app entry
	// eslint-disable-next-line global-require
	AppToRegister = require('./App').default;
}

registerRootComponent(AppToRegister);
// Helpful for debugging which entrypoint is being registered
// eslint-disable-next-line no-console
console.log('Index entry: registering', AppToRegister?.name || 'App');
