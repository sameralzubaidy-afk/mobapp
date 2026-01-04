declare module 'expo-device' {
  const Device: any;
  export = Device;
}

declare module 'expo-notifications' {
  const Notifications: any;
  export = Notifications;
}

// Global helpers used in legacy/dev-only screens
declare function getAllTestUsers(): any;
declare function getRandomTestUser(): any;
declare function isAtLeastAge(dob: string, age: number): boolean;
declare function signUp(input: any): Promise<any>;
declare const TestUser: any;
