// This is a simplified Firebase setup.
// In a real application, these values should come from a secure environment configuration.

// FIX: Declare firebase as a global constant to inform TypeScript that it's available
// in the global scope, likely from a <script> tag in the HTML. This resolves the
// "Cannot find name 'firebase'" error.
declare const firebase: any;

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
export const auth = firebase.auth();

// Create a promise that resolves after persistence is set.
// This is critical to prevent a race condition where auth operations are
// attempted before the persistence mode is configured, which causes the
// "operation-not-supported" error in restricted environments.
export const authReady = auth.setPersistence(firebase.auth.Auth.Persistence.NONE)
  .catch((error) => {
    console.error("Firebase: Could not set auth persistence.", error);
  });


const isMobileDevice = () => {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

export const signInWithGoogle = async () => {
  await authReady; // Ensure persistence is set before any auth operation.
  const provider = new firebase.auth.GoogleAuthProvider();
  // This prompt allows users to select which Google account they want to use,
  // which is key for the "Switch Account" functionality.
  provider.setCustomParameters({ prompt: 'select_account' });
  
  if (isMobileDevice()) {
    // For mobile devices, signInWithRedirect is more reliable and avoids popup-blocker issues.
    return auth.signInWithRedirect(provider);
  } else {
    // For desktop, signInWithPopup provides a better user experience.
    return auth.signInWithPopup(provider);
  }
};

export const signOutUser = async () => {
  await authReady; // Ensure persistence is set before signing out.
  return auth.signOut();
};